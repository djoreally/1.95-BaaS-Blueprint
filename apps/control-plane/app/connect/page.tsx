import ConnectForm from '../../components/ConnectForm';

/** Connect-hosting step of the approved journey. */
export default function ConnectPage() {
  return (
    <>
      <h1>Connect your hosting</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 640 }}>
        Point 1.95 BaaS at the cPanel account you already pay for. We verify
        everything <em>before</em> creating anything — the checklist below must
        go green first.
      </p>
      <ConnectForm />
    </>
  );
}
