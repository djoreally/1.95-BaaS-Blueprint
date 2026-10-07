// Custom PocketBase entrypoint with sqlite-vec registered.
// Build with: go build -o pocketbase -tags cgo ./main_vec.go
package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	sqlite3 "github.com/mattn/go-sqlite3"
	sqlitevec "github.com/asg017/sqlite-vec-go-bindings/cgo"
)

func main() {
	// Register the vec0 extension on every SQLite connection PocketBase opens.
	sqlite3.RegisterExtension("vec0", sqlitevec.Register)

	app, err := pocketbase.New()
	if err != nil {
		log.Fatal(err)
	}

	if err := app.Execute(); err != nil {
		log.Println(err)
		os.Exit(1)
	}
}
