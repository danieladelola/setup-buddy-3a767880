import { getDb } from "./db.server";

let _ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (_ready) return _ready;
  const sql = getDb();
  _ready = (async () => {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS contestants (
        id              BIGSERIAL PRIMARY KEY,
        full_name       TEXT NOT NULL,
        age             INTEGER,
        province        TEXT,
        district        TEXT,
        biography       TEXT,
        profile_photo   TEXT,
        gallery_images  JSONB NOT NULL DEFAULT '[]'::jsonb,
        social_links    JSONB NOT NULL DEFAULT '{}'::jsonb,
        agri_project    TEXT,
        education       TEXT,
        email           TEXT,
        phone           TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        votes           INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS votes (
        id            BIGSERIAL PRIMARY KEY,
        contestant_id BIGINT REFERENCES contestants(id) ON DELETE CASCADE,
        amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS applicants (
        id          BIGSERIAL PRIMARY KEY,
        full_name   TEXT NOT NULL,
        email       TEXT,
        province    TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS events (
        id          BIGSERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        location    TEXT,
        starts_at   TIMESTAMPTZ NOT NULL,
        description TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sponsors (
        id          BIGSERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        tier        TEXT,
        logo_url    TEXT,
        website     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id          BIGSERIAL PRIMARY KEY,
        title       TEXT,
        url         TEXT NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'image',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activities (
        id          BIGSERIAL PRIMARY KEY,
        kind        TEXT NOT NULL,
        message     TEXT NOT NULL,
        meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id              BIGSERIAL PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT,
        starts_at       TIMESTAMPTZ,
        ends_at         TIMESTAMPTZ,
        price_per_vote  NUMERIC(10,2) NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'draft',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE votes ADD COLUMN IF NOT EXISTS campaign_id BIGINT REFERENCES campaigns(id) ON DELETE SET NULL;
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_ip    TEXT;
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_email TEXT;
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'valid';
      CREATE INDEX IF NOT EXISTS votes_campaign_idx    ON votes(campaign_id);
      CREATE INDEX IF NOT EXISTS votes_contestant_idx  ON votes(contestant_id);
      CREATE INDEX IF NOT EXISTS votes_voter_ip_idx    ON votes(voter_ip);
      CREATE INDEX IF NOT EXISTS votes_voter_email_idx ON votes(voter_email);
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE events ADD COLUMN IF NOT EXISTS type         TEXT NOT NULL DEFAULT 'workshop';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'draft';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity     INTEGER;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(10,2) NOT NULL DEFAULT 0;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url   TEXT;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at      TIMESTAMPTZ;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS tickets (
        id            BIGSERIAL PRIMARY KEY,
        event_id      BIGINT REFERENCES events(id) ON DELETE CASCADE,
        holder_name   TEXT NOT NULL,
        email         TEXT,
        phone         TEXT,
        quantity      INTEGER NOT NULL DEFAULT 1,
        total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'reserved',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rsvps (
        id          BIGSERIAL PRIMARY KEY,
        event_id    BIGINT REFERENCES events(id) ON DELETE CASCADE,
        full_name   TEXT NOT NULL,
        email       TEXT,
        phone       TEXT,
        status      TEXT NOT NULL DEFAULT 'confirmed',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS industry TEXT;
      ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS company  TEXT;



      ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS category    TEXT NOT NULL DEFAULT 'photo';
      ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS mime_type   TEXT;
      ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS file_size   BIGINT;

      CREATE TABLE IF NOT EXISTS press_releases (
        id            BIGSERIAL PRIMARY KEY,
        title         TEXT NOT NULL,
        body          TEXT,
        published_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admins (
        id            BIGSERIAL PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS uploaded_files (
        id          BIGSERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        mime_type   TEXT NOT NULL,
        size        BIGINT NOT NULL,
        data        BYTEA NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contestant_applications (
        id                 BIGSERIAL PRIMARY KEY,
        full_name          TEXT NOT NULL,
        date_of_birth      DATE,
        phone              TEXT,
        email              TEXT,
        province           TEXT,
        occupation         TEXT,
        motivation         TEXT,
        payment_method     TEXT,
        payment_reference  TEXT,
        proof_url          TEXT,
        photo_url          TEXT,
        agreed             BOOLEAN NOT NULL DEFAULT FALSE,
        status             TEXT NOT NULL DEFAULT 'pending',
        admin_note         TEXT,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS category       TEXT;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS nrc_number     TEXT;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS gender         TEXT;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS agri_involved  BOOLEAN;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS agri_roles     JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS headshot_url   TEXT;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS fullbody_url   TEXT;
      ALTER TABLE contestant_applications ADD COLUMN IF NOT EXISTS nrc_url        TEXT;

      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS payment_ref TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS payment_ref TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS votes_payment_ref_key   ON votes(payment_ref);
      CREATE UNIQUE INDEX IF NOT EXISTS tickets_payment_ref_key ON tickets(payment_ref);

      -- Payment verification details recorded from Lenco.
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS paid_at         TIMESTAMPTZ;
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS paid_amount     NUMERIC(10,2);
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS lenco_ref       TEXT;
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS lenco_status    TEXT;
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS payment_channel TEXT;
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS failure_reason  TEXT;
      ALTER TABLE votes   ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS paid_at         TIMESTAMPTZ;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS paid_amount     NUMERIC(10,2);
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS lenco_ref       TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS lenco_status    TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS payment_channel TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS failure_reason  TEXT;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS votes_status_idx   ON votes(status);
      CREATE INDEX IF NOT EXISTS votes_created_idx  ON votes(created_at);
      CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);

    `);

    // Seed initial admin from env if table is empty
    const seedEmail = process.env.ADMIN_EMAIL;
    const seedPassword = process.env.ADMIN_PASSWORD;
    if (seedEmail && seedPassword) {
      const existing = await sql`SELECT COUNT(*)::int AS n FROM admins`;
      const n = (existing[0] as { n: number }).n;
      if (n === 0) {
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.hash(seedPassword, 10);
        await sql`INSERT INTO admins (email, password_hash) VALUES (${seedEmail.toLowerCase()}, ${hash}) ON CONFLICT (email) DO NOTHING`;
      }
    }

    // Seed demo contestants if empty. They start at 0 votes: public totals only ever come from confirmed votes.
    const cCount = await sql`SELECT COUNT(*)::int AS n FROM contestants`;
    if ((cCount[0] as { n: number }).n === 0) {
      const demo = [
        { full_name: "Chileshe Mwila", province: "Copperbelt", district: "Kitwe", agri_project: "School Agribusiness Clubs", biography: "Champion of school-led agribusiness programs across the Copperbelt." },
        { full_name: "Natasha Banda", province: "Lusaka", district: "Lusaka", agri_project: "Urban Farming Cooperative", biography: "Building urban farming cooperatives that feed the capital." },
        { full_name: "Isabella Dorcas Phiri", province: "Northern", district: "Kasama", agri_project: "Copperbelt", biography: "Connecting smallholder maize farmers to fair markets." },
        { full_name: "Mirriam Beenzu", province: "Eastern", district: "Chipata", agri_project: "Lusaka", biography: "Empowering women through community poultry enterprises." },
        { full_name: "Bwalya Kapamba", province: "Muchinga", district: "Mpika", agri_project: "Honey Value Chain", biography: "Developing a sustainable honey value chain in Muchinga." },
        
      ];
      for (const c of demo) {
        await sql`
          INSERT INTO contestants (full_name, province, district, agri_project, biography, status, votes)
          VALUES (${c.full_name}, ${c.province}, ${c.district}, ${c.agri_project}, ${c.biography}, 'approved', 0)
        `;
      }
    }

    // Migrate any old merged audition seed to the two correct dates
    await sql`DELETE FROM events WHERE type='audition' AND (location LIKE '%|%' OR title='2027 Auditions')`;

    // Seed demo audition events if none exist
    const aCount = await sql`SELECT COUNT(*)::int AS n FROM events WHERE type='audition'`;
    if ((aCount[0] as { n: number }).n === 0) {
      const demo = [
        { title: "2027 Auditions — Lusaka", type: "audition", location: "The Quorum Hotel, Lusaka", starts_at: "2026-07-05 10:00+02", description: "2027 Miss Agriculture Zambia auditions in Lusaka." },
        { title: "2027 Auditions — Livingstone", type: "audition", location: "Limpos Pub and Grill, Livingstone", starts_at: "2026-07-06 10:00+02", description: "2027 Miss Agriculture Zambia auditions in Livingstone." },
      ];
      for (const e of demo) {
        await sql`
          INSERT INTO events (title, type, location, starts_at, description, status)
          VALUES (${e.title}, ${e.type}, ${e.location}, ${e.starts_at}, ${e.description}, 'published')
        `;
      }
    }

    // Seed demo gallery media if empty
    const mCount = await sql`SELECT COUNT(*)::int AS n FROM media_assets WHERE category IN ('photo','gallery')`;
    if ((mCount[0] as { n: number }).n === 0) {
      const demo = [
        { title: "Grand Finale", url: "/gallery/gallery-2.jpg" },
        { title: "Parliament Tour", url: "/gallery/gallery-5.jpg" },
        { title: "Cultural Showcase", url: "/gallery/gallery-3.jpg" },
        { title: "Community Project", url: "/gallery/gallery-6.jpg" },
        { title: "Agricultural Activities", url: "/gallery/gallery-4.jpg" },
        { title: "Tourism Heritage", url: "/gallery/gallery-1.jpg" },
      ];
      for (const m of demo) {
        await sql`
          INSERT INTO media_assets (title, url, kind, category)
          VALUES (${m.title}, ${m.url}, 'image', 'gallery')
        `;
      }
    }

    // Seed an active voting campaign if none exists
    const camCount = await sql`SELECT COUNT(*)::int AS n FROM campaigns`;
    if ((camCount[0] as { n: number }).n === 0) {
      await sql`
        INSERT INTO campaigns (name, description, starts_at, ends_at, price_per_vote, status)
        VALUES (
          'Miss Agriculture Zambia 2026 — Public Vote',
          'Cast your vote for the contestant shaping the future of Zambian agriculture.',
          NOW() - INTERVAL '1 day',
          NOW() + INTERVAL '60 days',
          1.00,
          'active'
        )
      `;
    }

  })().catch((err) => {
    _ready = null;
    throw err;
  });
  return _ready;
}

export async function logActivity(kind: string, message: string, meta: Record<string, unknown> = {}) {
  const sql = getDb();
  await sql`INSERT INTO activities (kind, message, meta) VALUES (${kind}, ${message}, ${sql.json(meta as never)})`;
}