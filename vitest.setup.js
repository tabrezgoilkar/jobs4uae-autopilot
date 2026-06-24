// Tests must never depend on a real auth secret leaking in from a local .env —
// force the dev-bypass path so route tests run as the 'local' user. Individual
// auth tests set/restore CLERK_SECRET_KEY themselves.
delete process.env.CLERK_SECRET_KEY;
// And never hit a real Postgres from the test suite — force the filesystem kv.
delete process.env.DATABASE_URL;
