-- Signups and first use after Product Hunt (late Sept) and the DAV-Kongress flyers (QR → ?promo=DAV2026).
-- Read-only, aggregates only: no emails, names or ids in any result.
-- Run against production, e.g.:  psql "$DATABASE_URL" -f docs/marketing/queries/campaign-signups-2026-10.sql

BEGIN TRANSACTION READ ONLY;

-- 1. New accounts per day and channel since 2026-09-20.
SELECT created_at::date                                   AS day,
       CASE
         WHEN signup_promo_code IS NOT NULL                          THEN 'promo:' || signup_promo_code
         WHEN signup_attribution::text ILIKE '%producthunt%'         THEN 'producthunt'
         WHEN signup_attribution ->> 'utm_source' IS NOT NULL        THEN 'utm:' || (signup_attribution ->> 'utm_source')
         WHEN signup_gclid IS NOT NULL                               THEN 'google-ads'
         ELSE 'none'
       END                                                AS channel,
       auth_provider,
       preferred_locale,
       count(*)                                           AS signups
FROM astrologers
WHERE created_at >= '2026-09-20'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;

-- 2. Did they actually use it? Per channel: accounts, how many added at least one person,
--    and how many came back on a later day (any audit event after their signup day).
WITH a AS (
  SELECT id, created_at,
         CASE
           WHEN signup_promo_code IS NOT NULL                  THEN 'promo:' || signup_promo_code
           WHEN signup_attribution::text ILIKE '%producthunt%' THEN 'producthunt'
           ELSE 'other'
         END AS channel
  FROM astrologers
  WHERE created_at >= '2026-09-20'
)
SELECT channel,
       count(*)                                                                         AS accounts,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM persons p WHERE p.astrologer_id = a.id)) AS added_a_person,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM audit_events e
                                       WHERE e.actor_id = a.id
                                         AND e.created_at::date > a.created_at::date)) AS came_back_later
FROM a
GROUP BY 1
ORDER BY 2 DESC;

-- 3. Landings from campaign links, counted on the server (no cookies, no identifiers; see
--    app/services/campaign_visits.py). One row per page load, bots excluded, so read it as
--    "how many times a flyer or PH link was opened", not as people. Only recorded from the
--    deploy that added the counter; before it this returns nothing.
SELECT created_at::date                  AS day,
       resource_id                       AS campaign,
       properties ->> 'kind'             AS kind,
       properties ->> 'path'             AS landing_path,
       count(*)                          AS page_loads
FROM audit_events
WHERE action = 'campaign.visit'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;

COMMIT;
