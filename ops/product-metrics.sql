WITH
event_counts AS (
  SELECT
    COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_id END) AS users,
    COUNT(DISTINCT CASE WHEN name = 'submit_link_copied' THEN context END)
      AS submit_links_copied,
    COUNT(DISTINCT CASE WHEN name = 'overlay_link_copied' THEN context END)
      AS overlay_links_copied,
    COUNT(DISTINCT CASE WHEN name = 'letter_selected' THEN context END)
      AS sessions_with_selection,
    COUNT(DISTINCT CASE WHEN name = 'overlay_opened' THEN context END)
      AS sessions_with_overlay,
    COUNT(DISTINCT CASE WHEN name = 'returned' THEN session_id END) AS returned,
    COUNT(DISTINCT CASE
      WHEN name = 'visited' AND occurred_on >= date('now', '-6 days') THEN session_id
    END) AS users_7d
  FROM product_events
),
session_counts AS (
  SELECT
    COUNT(CASE WHEN status <> 'hidden' THEN 1 END) AS sessions_created,
    COUNT(CASE WHEN status = 'closed' THEN 1 END) AS sessions_closed,
    COUNT(CASE
      WHEN status <> 'hidden' AND created_at >= unixepoch() - (7 * 86400) THEN 1
    END) AS sessions_7d
  FROM sessions
),
letter_counts AS (
  SELECT
    COUNT(CASE WHEN letters.state <> 'hidden' THEN 1 END) AS letters_sent,
    COUNT(DISTINCT CASE WHEN letters.state <> 'hidden' THEN letters.session_id END)
      AS sessions_with_letters
  FROM letters
  JOIN sessions ON sessions.id = letters.session_id
  WHERE sessions.status <> 'hidden'
),
deep_sessions AS (
  SELECT COUNT(*) AS sessions_with_ten_letters
  FROM (
    SELECT letters.session_id
    FROM letters
    JOIN sessions ON sessions.id = letters.session_id
    WHERE letters.state <> 'hidden' AND sessions.status <> 'hidden'
    GROUP BY letters.session_id
    HAVING COUNT(*) >= 10
  )
),
repeat_hosts AS (
  SELECT COUNT(*) AS repeat_hosts
  FROM (
    SELECT creator_session_id
    FROM sessions
    WHERE status <> 'hidden'
    GROUP BY creator_session_id
    HAVING COUNT(*) >= 2
  )
)
SELECT
  event_counts.*,
  session_counts.*,
  letter_counts.*,
  deep_sessions.sessions_with_ten_letters,
  repeat_hosts.repeat_hosts
FROM event_counts, session_counts, letter_counts, deep_sessions, repeat_hosts;
