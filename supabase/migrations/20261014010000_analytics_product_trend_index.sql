-- Apply as a standalone migration, outside any BEGIN/COMMIT or enclosing
-- transaction, after 20261014000000. Concurrent build keeps ingestion writable.
-- Verify pg_index.indisvalid after deployment; a failed concurrent index build
-- requires operator review before retrying IF NOT EXISTS.
CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_product_trend_idx
ON public.analytics_dimensions_daily(business_id,dimension_key,day)
WHERE dimension='product' AND event_name='PRODUCT_VIEW';
