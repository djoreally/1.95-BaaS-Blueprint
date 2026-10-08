// InvisibleDB PocketBase runtime with sqlite-vec and first-class vector routes.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"

	sqlitevec "github.com/asg017/sqlite-vec-go-bindings/cgo"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

var safeCollection = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

type vectorUpsertRequest struct {
	Collection string    `json:"collection"`
	ID         string    `json:"id"`
	Embedding  []float64 `json:"embedding"`
}

type vectorQueryRequest struct {
	Collection string    `json:"collection"`
	Embedding  []float64 `json:"embedding"`
	Limit      int       `json:"limit"`
}

type vectorDeleteRequest struct {
	Collection string `json:"collection"`
	ID         string `json:"id"`
}

type vectorMeta struct {
	TableName  string `db:"table_name" json:"tableName"`
	Collection string `db:"collection" json:"collection"`
	Dimensions int    `db:"dimensions" json:"dimensions"`
}

type vectorHit struct {
	RecordID string  `db:"record_id" json:"id"`
	Distance float64 `db:"distance" json:"distance"`
}

func vectorTableName(collection string) string {
	sum := sha256.Sum256([]byte(collection))
	return "idb_vec_" + hex.EncodeToString(sum[:8])
}

func ensureVectorMeta(app core.App) error {
	_, err := app.DB().NewQuery(`
		CREATE TABLE IF NOT EXISTS idb_vector_meta (
			collection TEXT PRIMARY KEY,
			table_name TEXT NOT NULL UNIQUE,
			dimensions INTEGER NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`).Execute()
	return err
}

func findVectorMeta(app core.App, collection string) (*vectorMeta, error) {
	if err := ensureVectorMeta(app); err != nil {
		return nil, err
	}
	row := &vectorMeta{}
	err := app.DB().NewQuery(`
		SELECT collection, table_name, dimensions
		FROM idb_vector_meta
		WHERE collection = {:collection}
	`).Bind(dbx.Params{"collection": collection}).One(row)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func ensureVectorCollection(app core.App, collection string, dimensions int) (*vectorMeta, error) {
	if !safeCollection.MatchString(collection) {
		return nil, fmt.Errorf("invalid collection")
	}
	if dimensions < 1 || dimensions > 8192 {
		return nil, fmt.Errorf("embedding dimensions must be between 1 and 8192")
	}
	if _, err := app.FindCollectionByNameOrId(collection); err != nil {
		return nil, fmt.Errorf("collection not found")
	}
	if err := ensureVectorMeta(app); err != nil {
		return nil, err
	}

	meta, err := findVectorMeta(app, collection)
	if err == nil {
		if meta.Dimensions != dimensions {
			return nil, fmt.Errorf("collection vector dimension is %d, got %d; create a new vector collection for dimension changes", meta.Dimensions, dimensions)
		}
		return meta, nil
	}

	table := vectorTableName(collection)
	createSQL := fmt.Sprintf(`CREATE VIRTUAL TABLE IF NOT EXISTS "%s" USING vec0(record_id TEXT PRIMARY KEY, embedding float[%d])`, table, dimensions)
	if _, err := app.DB().NewQuery(createSQL).Execute(); err != nil {
		return nil, err
	}
	if _, err := app.DB().NewQuery(`
		INSERT OR IGNORE INTO idb_vector_meta(collection, table_name, dimensions)
		VALUES ({:collection}, {:table}, {:dimensions})
	`).Bind(dbx.Params{
		"collection": collection,
		"table":      table,
		"dimensions": dimensions,
	}).Execute(); err != nil {
		return nil, err
	}
	return &vectorMeta{Collection: collection, TableName: table, Dimensions: dimensions}, nil
}

func vectorJSON(values []float64) (string, error) {
	if len(values) == 0 || len(values) > 8192 {
		return "", fmt.Errorf("invalid embedding length")
	}
	for _, value := range values {
		if value != value || value > 1e38 || value < -1e38 {
			return "", fmt.Errorf("embedding contains invalid numeric value")
		}
	}
	encoded, err := json.Marshal(values)
	return string(encoded), err
}

func bindVectorRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Server-key lane only: maintain vector rows for existing PocketBase records.
		se.Router.POST("/api/vector/upsert", func(e *core.RequestEvent) error {
			body := &vectorUpsertRequest{}
			if err := e.BindBody(body); err != nil {
				return e.BadRequestError("invalid vector payload", err)
			}
			if !safeCollection.MatchString(body.Collection) || body.ID == "" {
				return e.BadRequestError("collection and record id are required", nil)
			}
			if _, err := e.App.FindRecordById(body.Collection, body.ID); err != nil {
				return e.NotFoundError("record not found", err)
			}
			meta, err := ensureVectorCollection(e.App, body.Collection, len(body.Embedding))
			if err != nil {
				return e.BadRequestError("vector collection setup failed", err)
			}
			vector, err := vectorJSON(body.Embedding)
			if err != nil {
				return e.BadRequestError("invalid embedding", err)
			}
			deleteSQL := fmt.Sprintf(`DELETE FROM "%s" WHERE record_id = {:id}`, meta.TableName)
			insertSQL := fmt.Sprintf(`INSERT INTO "%s"(record_id, embedding) VALUES ({:id}, {:embedding})`, meta.TableName)
			if err := e.App.RunInTransaction(func(tx core.App) error {
				if _, err := tx.DB().NewQuery(deleteSQL).Bind(dbx.Params{"id": body.ID}).Execute(); err != nil {
					return err
				}
				_, err := tx.DB().NewQuery(insertSQL).Bind(dbx.Params{"id": body.ID, "embedding": vector}).Execute()
				return err
			}); err != nil {
				return e.InternalServerError("vector upsert failed", err)
			}
			return e.JSON(http.StatusOK, map[string]any{"ok": true, "collection": body.Collection, "id": body.ID, "dimensions": meta.Dimensions})
		}).Bind(apis.RequireSuperuserAuth())

		se.Router.POST("/api/vector/delete", func(e *core.RequestEvent) error {
			body := &vectorDeleteRequest{}
			if err := e.BindBody(body); err != nil {
				return e.BadRequestError("invalid vector payload", err)
			}
			meta, err := findVectorMeta(e.App, body.Collection)
			if err != nil {
				return e.NotFoundError("vector collection not found", err)
			}
			query := fmt.Sprintf(`DELETE FROM "%s" WHERE record_id = {:id}`, meta.TableName)
			if _, err := e.App.DB().NewQuery(query).Bind(dbx.Params{"id": body.ID}).Execute(); err != nil {
				return e.InternalServerError("vector delete failed", err)
			}
			return e.JSON(http.StatusOK, map[string]bool{"ok": true})
		}).Bind(apis.RequireSuperuserAuth())

		// Query may be called by server-key, end-user token, or guest. Hydrated
		// PocketBase records are filtered through the collection ViewRule before
		// being returned, so vector search cannot bypass normal record security.
		se.Router.POST("/api/vector/query", func(e *core.RequestEvent) error {
			body := &vectorQueryRequest{}
			if err := e.BindBody(body); err != nil {
				return e.BadRequestError("invalid vector query", err)
			}
			meta, err := findVectorMeta(e.App, body.Collection)
			if err != nil {
				return e.NotFoundError("vector collection not found", err)
			}
			if len(body.Embedding) != meta.Dimensions {
				return e.BadRequestError(fmt.Sprintf("expected %d dimensions", meta.Dimensions), nil)
			}
			limit := body.Limit
			if limit <= 0 {
				limit = 10
			}
			if limit > 100 {
				limit = 100
			}
			vector, err := vectorJSON(body.Embedding)
			if err != nil {
				return e.BadRequestError("invalid embedding", err)
			}
			// Fetch extra neighbors because access rules may filter some hits.
			candidateLimit := limit * 4
			if candidateLimit > 200 {
				candidateLimit = 200
			}
			query := fmt.Sprintf(`SELECT record_id, distance FROM "%s" WHERE embedding MATCH {:embedding} AND k = {:limit} ORDER BY distance`, meta.TableName)
			hits := []vectorHit{}
			if err := e.App.DB().NewQuery(query).Bind(dbx.Params{"embedding": vector, "limit": candidateLimit}).All(&hits); err != nil {
				return e.InternalServerError("vector query failed", err)
			}
			info, err := e.RequestInfo()
			if err != nil {
				return e.InternalServerError("request authorization check failed", err)
			}
			collection, err := e.App.FindCollectionByNameOrId(body.Collection)
			if err != nil {
				return e.NotFoundError("collection not found", err)
			}
			results := make([]map[string]any, 0, limit)
			for _, hit := range hits {
				record, err := e.App.FindRecordById(body.Collection, hit.RecordID)
				if err != nil {
					continue
				}
				allowed, err := e.App.CanAccessRecord(record, info, collection.ViewRule)
				if err != nil || !allowed {
					continue
				}
				results = append(results, map[string]any{
					"id":       hit.RecordID,
					"distance": hit.Distance,
					"record":   record.PublicExport(),
				})
				if len(results) >= limit {
					break
				}
			}
			return e.JSON(http.StatusOK, map[string]any{"results": results, "dimensions": meta.Dimensions})
		})

		se.Router.GET("/api/vector/status", func(e *core.RequestEvent) error {
			if err := ensureVectorMeta(e.App); err != nil {
				return e.InternalServerError("vector status failed", err)
			}
			rows := []vectorMeta{}
			if err := e.App.DB().NewQuery(`SELECT collection, table_name, dimensions FROM idb_vector_meta ORDER BY collection`).All(&rows); err != nil {
				return e.InternalServerError("vector status failed", err)
			}
			return e.JSON(http.StatusOK, map[string]any{"collections": rows})
		}).Bind(apis.RequireSuperuserAuth())

		return se.Next()
	})
}

func main() {
	// Register sqlite-vec for every SQLite connection opened by this process.
	sqlitevec.Auto()
	defer sqlitevec.Cancel()

	app := pocketbase.New()
	bindVectorRoutes(app)
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
