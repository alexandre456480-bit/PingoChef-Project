-- Read-only operations for a privileged DBA console. Do not expose via HTTP.
-- Never export query text/parameters: they may contain private data.
SELECT extname FROM pg_extension WHERE extname='pg_stat_statements';

-- Run these only if the extension above is available in the database search_path.
SELECT queryid,calls,total_exec_time,mean_exec_time,rows,shared_blks_hit,shared_blks_read
FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
ORDER BY total_exec_time DESC LIMIT 20;
SELECT queryid,calls,total_exec_time,mean_exec_time
FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
ORDER BY calls DESC LIMIT 20;
SELECT queryid,calls,total_exec_time,mean_exec_time
FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
ORDER BY mean_exec_time DESC LIMIT 20;

SELECT i.relname AS index_name,ix.indisvalid,ix.indisready,pg_size_pretty(pg_relation_size(i.oid)) AS size
FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid
WHERE i.relname='analytics_product_trend_idx';
