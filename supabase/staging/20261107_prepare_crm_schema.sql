-- STAGING-ONLY SCHEMA SNAPSHOT; NEVER APPLY TO THE PRODUCTION DATABASE.
-- Vetted source: supabase/baseline/20261103-public.sql (schema only, no data).
-- Keeps CRM schema and private_access authorization compatible with production;
-- explicitly excludes broad ALTER DEFAULT PRIVILEGES grants, anonymous sequence ALL,
-- and incorporates the presence_site bucket check from the 20261103 follow-on migration.
-- DO NOT PLACE IN supabase/migrations: this snapshot is for an EMPTY STAGING CRM ONLY.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."claim_api_request_for_user"("p_user_id" "uuid", "p_bucket" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_limit integer;
  v_window_seconds integer := 900;
  v_allowed boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.private_access pa
    where pa.user_id = p_user_id
  ) then
    return false;
  end if;

  v_limit := case p_bucket
    when 'places_search' then 90
    when 'lead_enrichment' then 30
    when 'presence_discovery' then 20
    when 'presence_site' then 80
    when 'deep_enrichment' then 12
    else null
  end;

  if v_limit is null then
    return false;
  end if;

  insert into public.api_request_rate_limit (
    user_id,
    bucket,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_user_id,
    p_bucket,
    now(),
    1,
    now()
  )
  on conflict (user_id, bucket)
  do update set
    window_started_at = case
      when public.api_request_rate_limit.window_started_at <
        now() - make_interval(secs => v_window_seconds)
      then now()
      else public.api_request_rate_limit.window_started_at
    end,
    request_count = case
      when public.api_request_rate_limit.window_started_at <
        now() - make_interval(secs => v_window_seconds)
      then 1
      else public.api_request_rate_limit.request_count + 1
    end,
    updated_at = now()
  returning request_count <= v_limit into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;


ALTER FUNCTION "public"."claim_api_request_for_user"("p_user_id" "uuid", "p_bucket" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_open_now_refresh"("p_user_id" "uuid", "p_location_key" "text", "p_limit" integer DEFAULT 140, "p_window_seconds" integer DEFAULT 900) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  allowed boolean;
begin
  insert into public.open_now_refresh_guard (
    user_id,
    location_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_user_id,
    p_location_key,
    now(),
    1,
    now()
  )
  on conflict (user_id, location_key)
  do update set
    window_started_at = case
      when public.open_now_refresh_guard.window_started_at <
        now() - make_interval(secs => p_window_seconds)
      then now()
      else public.open_now_refresh_guard.window_started_at
    end,
    request_count = case
      when public.open_now_refresh_guard.window_started_at <
        now() - make_interval(secs => p_window_seconds)
      then 1
      else public.open_now_refresh_guard.request_count + 1
    end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return coalesce(allowed, false);
end;
$$;


ALTER FUNCTION "public"."claim_open_now_refresh"("p_user_id" "uuid", "p_location_key" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_lead_added_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  status_label text;
begin
  status_label := case new.status
    when 'send_message' then 'Enviar mensagem'
    when 'waiting' then 'Aguardando'
    when 'accepted' then 'Aceito'
    when 'rejected' then 'Recusado'
    else new.status
  end;

  insert into public.lead_activities (
    lead_id,
    user_id,
    type,
    title,
    description,
    metadata,
    created_at
  )
  values (
    new.id,
    new.user_id,
    'lead_added',
    'Empresa adicionada aos Meus Leads',
    'Status inicial: ' || status_label,
    jsonb_build_object(
      'initialStatus', new.status,
      'initialStatusLabel', status_label
    ),
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."record_lead_added_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_leads_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_leads_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."api_request_rate_limit" (
    "user_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "api_request_rate_limit_bucket_check" CHECK (("bucket" = ANY (ARRAY['places_search'::"text", 'lead_enrichment'::"text", 'presence_discovery'::"text", 'presence_site'::"text", 'deep_enrichment'::"text"]))),
    CONSTRAINT "api_request_rate_limit_count_check" CHECK (("request_count" >= 0))
);


ALTER TABLE "public"."api_request_rate_limit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_enrichment_facts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "business_key" "text" NOT NULL,
    "source_id" "uuid",
    "fact_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "normalized_value" "text" NOT NULL,
    "fact_signature" "text" NOT NULL,
    "confidence" "text" NOT NULL,
    "resolution" "text" NOT NULL,
    "evidence_summary" "text",
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_enrichment_facts_confidence_check" CHECK (("confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "business_enrichment_facts_resolution_check" CHECK (("resolution" = ANY (ARRAY['auto_verified'::"text", 'needs_review'::"text", 'low_confidence'::"text", 'manual_verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."business_enrichment_facts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_enrichment_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "business_key" "text" NOT NULL,
    "place_id" "text",
    "identity_signature" "text" NOT NULL,
    "identity" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "niche_key" "text" NOT NULL,
    "niche_family" "text" NOT NULL,
    "status" "text" DEFAULT 'researching'::"text" NOT NULL,
    "quality" "text",
    "completeness" numeric(5,4),
    "verified_content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "verified_images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confirmed_channels" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "identity_updates" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_summary" "text",
    "force_refresh" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "checked_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "engine_version" "text",
    "summary_indicators" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "business_enrichment_runs_quality_check" CHECK ((("quality" IS NULL) OR ("quality" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))),
    CONSTRAINT "business_enrichment_runs_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'researching'::"text", 'completed'::"text", 'needs_review'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."business_enrichment_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_enrichment_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "source_type" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_domain" "text" NOT NULL,
    "page_title" "text",
    "extraction_method" "text" NOT NULL,
    "identity_score" integer DEFAULT 0 NOT NULL,
    "confidence" "text" NOT NULL,
    "source_updated_at" timestamp with time zone,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_kind" "text",
    "fetch_method" "text",
    "extraction_status" "text",
    "browserless_decision" "text",
    "browserless_reason" "text",
    "linked_from" "text",
    "facts_found" integer DEFAULT 0 NOT NULL,
    "identity_status" "text",
    "identity_reason" "text",
    "rejection_reason" "text",
    CONSTRAINT "business_enrichment_sources_confidence_check" CHECK (("confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "business_enrichment_sources_extraction_status_check" CHECK ((("extraction_status" IS NULL) OR ("extraction_status" = ANY (ARRAY['successful'::"text", 'partial'::"text", 'inconclusive'::"text", 'blocked'::"text", 'failed'::"text"])))),
    CONSTRAINT "business_enrichment_sources_identity_score_check" CHECK ((("identity_score" >= 0) AND ("identity_score" <= 100))),
    CONSTRAINT "business_enrichment_sources_identity_status_check" CHECK ((("identity_status" IS NULL) OR ("identity_status" = ANY (ARRAY['confirmed'::"text", 'probable'::"text", 'insufficient'::"text", 'mismatch'::"text"]))))
);


ALTER TABLE "public"."business_enrichment_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_activities" (
    "id" bigint NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_activities_type_check" CHECK (("type" = ANY (ARRAY['lead_added'::"text", 'whatsapp_opened'::"text", 'prompt_generated'::"text", 'status_changed'::"text", 'company_updated'::"text", 'lead_edited'::"text", 'deep_enrichment'::"text", 'deep_enrichment_review'::"text", 'manual_note'::"text", 'next_action_set'::"text", 'next_action_completed'::"text", 'follow_up'::"text"])))
);


ALTER TABLE "public"."lead_activities" OWNER TO "postgres";


ALTER TABLE "public"."lead_activities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lead_activities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."lead_payments" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_method_other" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_payments_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "lead_payments_method_check" CHECK (("payment_method" = ANY (ARRAY['pix'::"text", 'cash'::"text", 'card'::"text", 'transfer'::"text", 'other'::"text"]))),
    CONSTRAINT "lead_payments_notes_length_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500))),
    CONSTRAINT "lead_payments_other_length_check" CHECK ((("payment_method_other" IS NULL) OR ("char_length"("payment_method_other") <= 80)))
);


ALTER TABLE "public"."lead_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_updates" (
    "id" bigint NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "place_id" "text",
    "change_type" "text" NOT NULL,
    "field_name" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "message" "text" NOT NULL,
    "importance" "text" DEFAULT 'normal'::"text" NOT NULL,
    "source" "text" DEFAULT 'google_places_sync'::"text" NOT NULL,
    "is_seen" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_updates_importance_check" CHECK (("importance" = ANY (ARRAY['normal'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."lead_updates" OWNER TO "postgres";


ALTER TABLE "public"."lead_updates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."lead_updates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company" "text" NOT NULL,
    "segment" "text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "previous_phone" "text",
    "status" "text" DEFAULT 'send_message'::"text" NOT NULL,
    "first_contact" "date" NOT NULL,
    "last_contact" "date",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "place_id" "text",
    "address" "text",
    "website" "text",
    "google_maps_url" "text",
    "instagram" "text",
    "instagram_confidence" "text",
    "instagram_source" "text",
    "instagram_checked_at" timestamp with time zone,
    "factual_description" "text",
    "primary_category" "text",
    "categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "description" "text",
    "neighborhood" "text",
    "city" "text",
    "state" "text",
    "international_phone" "text",
    "rating" double precision,
    "review_count" integer,
    "is_open_now" boolean,
    "opening_hours" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "business_status" "text",
    "latitude" double precision,
    "longitude" double precision,
    "enriched_at" timestamp with time zone,
    "source" "text",
    "auto_sync_enabled" boolean DEFAULT true NOT NULL,
    "last_synced_at" timestamp with time zone,
    "last_sync_error" "text",
    "last_sync_error_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instagram_username" "text",
    "instagram_candidates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "instagram_rejected_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "instagram_search_signature" "text",
    "instagram_needs_review" boolean DEFAULT false NOT NULL,
    "verified_content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "verified_images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confirmed_channels" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "deep_enrichment_status" "text",
    "deep_enrichment_quality" "text",
    "deep_enrichment_checked_at" timestamp with time zone,
    "project_value" numeric(12,2),
    "financial_notes" "text",
    "next_action_type" "text",
    "next_action_date" "date",
    "next_action_notes" "text",
    "instagram_display_name" "text",
    CONSTRAINT "leads_instagram_candidates_array_check" CHECK (("jsonb_typeof"("instagram_candidates") = 'array'::"text")),
    CONSTRAINT "leads_instagram_confidence_check" CHECK ((("instagram_confidence" IS NULL) OR ("instagram_confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))),
    CONSTRAINT "leads_instagram_source_check" CHECK ((("instagram_source" IS NULL) OR ("instagram_source" = ANY (ARRAY['google_places'::"text", 'official_website'::"text", 'web_search'::"text", 'manual_confirmation'::"text", 'existing_data'::"text"])))),
    CONSTRAINT "leads_next_action_notes_length_check" CHECK ((("next_action_notes" IS NULL) OR ("char_length"("next_action_notes") <= 500))),
    CONSTRAINT "leads_next_action_type_check" CHECK ((("next_action_type" IS NULL) OR ("next_action_type" = ANY (ARRAY['initial_contact'::"text", 'follow_up'::"text", 'send_proposal'::"text", 'wait'::"text", 'meeting'::"text", 'collect_payment'::"text", 'other'::"text"])))),
    CONSTRAINT "leads_project_value_nonnegative" CHECK ((("project_value" IS NULL) OR ("project_value" >= (0)::numeric))),
    CONSTRAINT "leads_source_check" CHECK ((("source" IS NULL) OR ("source" = ANY (ARRAY['manual'::"text", 'lavras-search'::"text", 'places-search'::"text"])))),
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['send_message'::"text", 'waiting'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."open_now_niche_cache" (
    "user_id" "uuid" NOT NULL,
    "location_key" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "segment" "text" NOT NULL,
    "family" "text" NOT NULL,
    "status" "text" DEFAULT 'not_checked'::"text" NOT NULL,
    "checked_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "next_page_token" "text",
    "page_count" integer DEFAULT 0 NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "locked_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "open_now_niche_cache_status_check" CHECK (("status" = ANY (ARRAY['open_results'::"text", 'no_open_results'::"text", 'not_checked'::"text", 'checking'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."open_now_niche_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."open_now_refresh_guard" (
    "user_id" "uuid" NOT NULL,
    "location_key" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."open_now_refresh_guard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places_search_cache" (
    "user_id" "uuid" NOT NULL,
    "location_key" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "segment" "text" NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_page_token" "text",
    "page_count" integer DEFAULT 1 NOT NULL,
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "places_search_cache_city_length" CHECK ((("char_length"("city") >= 2) AND ("char_length"("city") <= 120))),
    CONSTRAINT "places_search_cache_location_key_length" CHECK ((("char_length"("location_key") >= 3) AND ("char_length"("location_key") <= 240))),
    CONSTRAINT "places_search_cache_page_count_positive" CHECK (("page_count" >= 1)),
    CONSTRAINT "places_search_cache_results_array" CHECK (("jsonb_typeof"("results") = 'array'::"text")),
    CONSTRAINT "places_search_cache_segment_length" CHECK ((("char_length"("segment") >= 2) AND ("char_length"("segment") <= 160))),
    CONSTRAINT "places_search_cache_state_length" CHECK ((("char_length"("state") >= 2) AND ("char_length"("state") <= 40)))
);


ALTER TABLE "public"."places_search_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."private_access" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."private_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_visual_reference_assets" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "reference_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_hash" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'image/webp'::"text" NOT NULL,
    "byte_size" integer NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "segment_kind" "text" NOT NULL,
    "sort_order" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prompt_visual_reference_assets_dimensions_check" CHECK ((("width" > 0) AND ("height" > 0))),
    CONSTRAINT "prompt_visual_reference_assets_mime_check" CHECK (("mime_type" = 'image/webp'::"text")),
    CONSTRAINT "prompt_visual_reference_assets_segment_check" CHECK (("segment_kind" = ANY (ARRAY['full'::"text", 'hero'::"text", 'middle'::"text", 'final'::"text"]))),
    CONSTRAINT "prompt_visual_reference_assets_size_check" CHECK ((("byte_size" > 0) AND ("byte_size" <= 3145728)))
);


ALTER TABLE "public"."prompt_visual_reference_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_visual_reference_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_key" "text" NOT NULL,
    "guidance" "text" DEFAULT ''::"text" NOT NULL,
    "analysis" "jsonb",
    "analysis_signature" "text",
    "analysis_model" "text",
    "analyzed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prompt_visual_reference_sets_business_key_check" CHECK ((("char_length"("business_key") >= 1) AND ("char_length"("business_key") <= 700))),
    CONSTRAINT "prompt_visual_reference_sets_guidance_check" CHECK (("char_length"("guidance") <= 1200))
);


ALTER TABLE "public"."prompt_visual_reference_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_visual_references" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "set_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_hash" "text",
    "storage_path" "text",
    "original_name" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'image/webp'::"text",
    "byte_size" integer,
    "width" integer,
    "height" integer,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reference_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "source_url" "text",
    "source_domain" "text",
    "capture_status" "text",
    "capture_error" "text",
    "capture_hash" "text",
    "capture_final_url" "text",
    "capture_title" "text",
    "captured_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "removed_at" timestamp with time zone,
    CONSTRAINT "prompt_visual_references_active_shape_check" CHECK (((("active" = true) AND ("sort_order" IS NOT NULL) AND ("removed_at" IS NULL)) OR (("active" = false) AND ("sort_order" IS NULL) AND ("removed_at" IS NOT NULL)))),
    CONSTRAINT "prompt_visual_references_byte_size_check" CHECK ((("byte_size" > 0) AND ("byte_size" <= 3145728))),
    CONSTRAINT "prompt_visual_references_capture_status_check" CHECK ((("capture_status" IS NULL) OR ("capture_status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'failed'::"text"])))),
    CONSTRAINT "prompt_visual_references_file_hash_check" CHECK (("file_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "prompt_visual_references_height_check" CHECK ((("height" > 0) AND ("height" <= 12000))),
    CONSTRAINT "prompt_visual_references_mime_type_check" CHECK (("mime_type" = 'image/webp'::"text")),
    CONSTRAINT "prompt_visual_references_note_check" CHECK (("char_length"("note") <= 500)),
    CONSTRAINT "prompt_visual_references_original_name_check" CHECK ((("char_length"("original_name") >= 1) AND ("char_length"("original_name") <= 240))),
    CONSTRAINT "prompt_visual_references_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['image'::"text", 'url'::"text"]))),
    CONSTRAINT "prompt_visual_references_shape_check" CHECK (((("reference_type" = 'image'::"text") AND ("file_hash" IS NOT NULL) AND ("storage_path" IS NOT NULL) AND ("mime_type" = 'image/webp'::"text") AND ("byte_size" IS NOT NULL) AND ("width" IS NOT NULL) AND ("height" IS NOT NULL) AND ("source_url" IS NULL)) OR (("reference_type" = 'url'::"text") AND ("source_url" IS NOT NULL) AND ("source_domain" IS NOT NULL)))),
    CONSTRAINT "prompt_visual_references_sort_order_check" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 4))),
    CONSTRAINT "prompt_visual_references_width_check" CHECK ((("width" > 0) AND ("width" <= 1600)))
);


ALTER TABLE "public"."prompt_visual_references" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_previews" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_key" "text" NOT NULL,
    "company" "text" NOT NULL,
    "prompt_version" "text" NOT NULL,
    "preview_version" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "preview_spec" "jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "preview_engine_version" "text"
);


ALTER TABLE "public"."site_previews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_internal_config" (
    "config_key" "text" NOT NULL,
    "secret_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sync_internal_config" OWNER TO "postgres";


ALTER TABLE ONLY "public"."api_request_rate_limit"
    ADD CONSTRAINT "api_request_rate_limit_pkey" PRIMARY KEY ("user_id", "bucket");



ALTER TABLE ONLY "public"."business_enrichment_facts"
    ADD CONSTRAINT "business_enrichment_facts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_enrichment_runs"
    ADD CONSTRAINT "business_enrichment_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_enrichment_sources"
    ADD CONSTRAINT "business_enrichment_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_payments"
    ADD CONSTRAINT "lead_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_updates"
    ADD CONSTRAINT "lead_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_now_niche_cache"
    ADD CONSTRAINT "open_now_niche_cache_pkey" PRIMARY KEY ("user_id", "location_key", "segment");



ALTER TABLE ONLY "public"."open_now_refresh_guard"
    ADD CONSTRAINT "open_now_refresh_guard_pkey" PRIMARY KEY ("user_id", "location_key");



ALTER TABLE ONLY "public"."places_search_cache"
    ADD CONSTRAINT "places_search_cache_pkey" PRIMARY KEY ("user_id", "location_key", "segment");



ALTER TABLE ONLY "public"."private_access"
    ADD CONSTRAINT "private_access_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."prompt_visual_reference_assets"
    ADD CONSTRAINT "prompt_visual_reference_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_visual_reference_assets"
    ADD CONSTRAINT "prompt_visual_reference_assets_reference_id_file_hash_key" UNIQUE ("reference_id", "file_hash");



ALTER TABLE ONLY "public"."prompt_visual_reference_assets"
    ADD CONSTRAINT "prompt_visual_reference_assets_reference_id_sort_order_key" UNIQUE ("reference_id", "sort_order");



ALTER TABLE ONLY "public"."prompt_visual_reference_sets"
    ADD CONSTRAINT "prompt_visual_reference_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_visual_reference_sets"
    ADD CONSTRAINT "prompt_visual_reference_sets_user_id_business_key_key" UNIQUE ("user_id", "business_key");



ALTER TABLE ONLY "public"."prompt_visual_references"
    ADD CONSTRAINT "prompt_visual_references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_visual_references"
    ADD CONSTRAINT "prompt_visual_references_set_id_file_hash_key" UNIQUE ("set_id", "file_hash");



ALTER TABLE ONLY "public"."prompt_visual_references"
    ADD CONSTRAINT "prompt_visual_references_set_id_sort_order_key" UNIQUE ("set_id", "sort_order");



ALTER TABLE ONLY "public"."prompt_visual_references"
    ADD CONSTRAINT "prompt_visual_references_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."site_previews"
    ADD CONSTRAINT "site_previews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_previews"
    ADD CONSTRAINT "site_previews_user_id_business_key_key" UNIQUE ("user_id", "business_key");



ALTER TABLE ONLY "public"."sync_internal_config"
    ADD CONSTRAINT "sync_internal_config_pkey" PRIMARY KEY ("config_key");



CREATE INDEX "business_enrichment_facts_rejections_idx" ON "public"."business_enrichment_facts" USING "btree" ("user_id", "business_key", "fact_signature") WHERE ("resolution" = 'rejected'::"text");



CREATE INDEX "business_enrichment_facts_run_idx" ON "public"."business_enrichment_facts" USING "btree" ("run_id", "resolution", "fact_type");



CREATE INDEX "business_enrichment_runs_cache_idx" ON "public"."business_enrichment_runs" USING "btree" ("user_id", "identity_signature", "expires_at" DESC) WHERE ("status" = ANY (ARRAY['completed'::"text", 'needs_review'::"text"]));



CREATE INDEX "business_enrichment_runs_user_business_idx" ON "public"."business_enrichment_runs" USING "btree" ("user_id", "business_key", "created_at" DESC);



CREATE INDEX "business_enrichment_sources_run_idx" ON "public"."business_enrichment_sources" USING "btree" ("run_id");



CREATE INDEX "lead_activities_lead_id_idx" ON "public"."lead_activities" USING "btree" ("lead_id");



CREATE UNIQUE INDEX "lead_activities_one_added_per_lead_idx" ON "public"."lead_activities" USING "btree" ("user_id", "lead_id") WHERE ("type" = 'lead_added'::"text");



CREATE INDEX "lead_activities_user_lead_created_idx" ON "public"."lead_activities" USING "btree" ("user_id", "lead_id", "created_at" DESC);



CREATE INDEX "lead_payments_lead_date_idx" ON "public"."lead_payments" USING "btree" ("lead_id", "payment_date" DESC, "created_at" DESC);



CREATE INDEX "lead_payments_user_date_idx" ON "public"."lead_payments" USING "btree" ("user_id", "payment_date" DESC);



CREATE INDEX "lead_updates_lead_seen_idx" ON "public"."lead_updates" USING "btree" ("lead_id", "is_seen", "created_at" DESC);



CREATE INDEX "lead_updates_user_created_idx" ON "public"."lead_updates" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "leads_place_id_idx" ON "public"."leads" USING "btree" ("place_id") WHERE ("place_id" IS NOT NULL);



CREATE INDEX "leads_sync_eligible_idx" ON "public"."leads" USING "btree" ("auto_sync_enabled", "last_synced_at") WHERE ("place_id" IS NOT NULL);



CREATE INDEX "leads_user_id_idx" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "leads_user_next_action_date_idx" ON "public"."leads" USING "btree" ("user_id", "next_action_date") WHERE ("next_action_date" IS NOT NULL);



CREATE INDEX "open_now_niche_cache_location_idx" ON "public"."open_now_niche_cache" USING "btree" ("user_id", "location_key", "checked_at" DESC);



CREATE INDEX "places_search_cache_checked_idx" ON "public"."places_search_cache" USING "btree" ("user_id", "checked_at" DESC);



CREATE INDEX "places_search_cache_location_idx" ON "public"."places_search_cache" USING "btree" ("user_id", "location_key");



CREATE INDEX "prompt_visual_reference_assets_user_id_idx" ON "public"."prompt_visual_reference_assets" USING "btree" ("user_id");



CREATE INDEX "prompt_visual_references_active_set_idx" ON "public"."prompt_visual_references" USING "btree" ("set_id", "sort_order") WHERE ("active" = true);



CREATE UNIQUE INDEX "prompt_visual_references_set_url_unique_idx" ON "public"."prompt_visual_references" USING "btree" ("set_id", "source_url") WHERE ("reference_type" = 'url'::"text");



CREATE INDEX "prompt_visual_references_user_id_idx" ON "public"."prompt_visual_references" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "leads_record_added_activity" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."record_lead_added_activity"();



CREATE OR REPLACE TRIGGER "leads_set_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_leads_updated_at"();



ALTER TABLE ONLY "public"."api_request_rate_limit"
    ADD CONSTRAINT "api_request_rate_limit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_facts"
    ADD CONSTRAINT "business_enrichment_facts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_facts"
    ADD CONSTRAINT "business_enrichment_facts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."business_enrichment_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_facts"
    ADD CONSTRAINT "business_enrichment_facts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."business_enrichment_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_enrichment_facts"
    ADD CONSTRAINT "business_enrichment_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_runs"
    ADD CONSTRAINT "business_enrichment_runs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_runs"
    ADD CONSTRAINT "business_enrichment_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_sources"
    ADD CONSTRAINT "business_enrichment_sources_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_sources"
    ADD CONSTRAINT "business_enrichment_sources_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."business_enrichment_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_enrichment_sources"
    ADD CONSTRAINT "business_enrichment_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_payments"
    ADD CONSTRAINT "lead_payments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_payments"
    ADD CONSTRAINT "lead_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_updates"
    ADD CONSTRAINT "lead_updates_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_updates"
    ADD CONSTRAINT "lead_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_now_niche_cache"
    ADD CONSTRAINT "open_now_niche_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."open_now_refresh_guard"
    ADD CONSTRAINT "open_now_refresh_guard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places_search_cache"
    ADD CONSTRAINT "places_search_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_access"
    ADD CONSTRAINT "private_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_visual_reference_assets"
    ADD CONSTRAINT "prompt_visual_reference_assets_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."prompt_visual_references"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_visual_reference_assets"
    ADD CONSTRAINT "prompt_visual_reference_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_visual_reference_sets"
    ADD CONSTRAINT "prompt_visual_reference_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_visual_references"
    ADD CONSTRAINT "prompt_visual_references_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."prompt_visual_reference_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_visual_references"
    ADD CONSTRAINT "prompt_visual_references_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_previews"
    ADD CONSTRAINT "site_previews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "No direct client access to API rate limits" ON "public"."api_request_rate_limit" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "No direct client access to open now refresh guard" ON "public"."open_now_refresh_guard" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "No direct client access to sync config" ON "public"."sync_internal_config" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Users can add own lead payments" ON "public"."lead_payments" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_payments"."lead_id") AND ("leads"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert own places search cache" ON "public"."places_search_cache" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own lead payments" ON "public"."lead_payments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own open now cache" ON "public"."open_now_niche_cache" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own places search cache" ON "public"."places_search_cache" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own places search cache" ON "public"."places_search_cache" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."api_request_rate_limit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_enrichment_facts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_enrichment_facts_select_own" ON "public"."business_enrichment_facts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."business_enrichment_runs" "r"
  WHERE (("r"."id" = "business_enrichment_facts"."run_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."business_enrichment_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_enrichment_runs_select_own" ON "public"."business_enrichment_runs" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (("lead_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "business_enrichment_runs"."lead_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."business_enrichment_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_enrichment_sources_select_own" ON "public"."business_enrichment_sources" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."business_enrichment_runs" "r"
  WHERE (("r"."id" = "business_enrichment_sources"."run_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."lead_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_activities_delete_manual_note_own" ON "public"."lead_activities" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("type" = 'manual_note'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "lead_activities_insert_own" ON "public"."lead_activities" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "lead_activities_select_own" ON "public"."lead_activities" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "lead_activities_update_manual_note_own" ON "public"."lead_activities" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("type" = 'manual_note'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("type" = 'manual_note'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."lead_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_updates_mark_seen_own" ON "public"."lead_updates" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "lead_updates_select_own" ON "public"."lead_updates" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_delete_own" ON "public"."leads" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "leads_insert_own" ON "public"."leads" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "leads_select_own" ON "public"."leads" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "leads_update_own" ON "public"."leads" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."open_now_niche_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_now_refresh_guard" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places_search_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "private_access_select_self" ON "public"."private_access" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."prompt_visual_reference_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_visual_reference_assets_delete_own" ON "public"."prompt_visual_reference_assets" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."prompt_visual_references" "r"
  WHERE (("r"."id" = "prompt_visual_reference_assets"."reference_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "prompt_visual_reference_assets_insert_own" ON "public"."prompt_visual_reference_assets" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM ("public"."prompt_visual_references" "r"
     JOIN "public"."prompt_visual_reference_sets" "s" ON (("s"."id" = "r"."set_id")))
  WHERE (("r"."id" = "prompt_visual_reference_assets"."reference_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "prompt_visual_reference_assets_select_own" ON "public"."prompt_visual_reference_assets" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM ("public"."prompt_visual_references" "r"
     JOIN "public"."prompt_visual_reference_sets" "s" ON (("s"."id" = "r"."set_id")))
  WHERE (("r"."id" = "prompt_visual_reference_assets"."reference_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."prompt_visual_reference_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_visual_reference_sets_delete_own" ON "public"."prompt_visual_reference_sets" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "prompt_visual_reference_sets_insert_own" ON "public"."prompt_visual_reference_sets" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "prompt_visual_reference_sets_select_own" ON "public"."prompt_visual_reference_sets" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "prompt_visual_reference_sets_update_own" ON "public"."prompt_visual_reference_sets" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."prompt_visual_references" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_visual_references_delete_own" ON "public"."prompt_visual_references" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."prompt_visual_reference_sets" "s"
  WHERE (("s"."id" = "prompt_visual_references"."set_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "prompt_visual_references_insert_own" ON "public"."prompt_visual_references" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."prompt_visual_reference_sets" "s"
  WHERE (("s"."id" = "prompt_visual_references"."set_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "prompt_visual_references_select_own" ON "public"."prompt_visual_references" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."prompt_visual_reference_sets" "s"
  WHERE (("s"."id" = "prompt_visual_references"."set_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "prompt_visual_references_update_own" ON "public"."prompt_visual_references" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."prompt_visual_reference_sets" "s"
  WHERE (("s"."id" = "prompt_visual_references"."set_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (EXISTS ( SELECT 1
   FROM "public"."prompt_visual_reference_sets" "s"
  WHERE (("s"."id" = "prompt_visual_references"."set_id") AND ("s"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."site_previews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_previews_delete_own" ON "public"."site_previews" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "site_previews_insert_own" ON "public"."site_previews" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "site_previews_select_own" ON "public"."site_previews" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "site_previews_update_own" ON "public"."site_previews" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."private_access" "pa"
  WHERE ("pa"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."sync_internal_config" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_api_request_for_user"("p_user_id" "uuid", "p_bucket" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_api_request_for_user"("p_user_id" "uuid", "p_bucket" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_open_now_refresh"("p_user_id" "uuid", "p_location_key" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_open_now_refresh"("p_user_id" "uuid", "p_location_key" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_lead_added_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_lead_added_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_leads_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_leads_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."api_request_rate_limit" TO "service_role";



GRANT ALL ON TABLE "public"."business_enrichment_facts" TO "service_role";



GRANT ALL ON TABLE "public"."business_enrichment_runs" TO "service_role";



GRANT ALL ON TABLE "public"."business_enrichment_sources" TO "service_role";



GRANT ALL ON TABLE "public"."lead_activities" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lead_activities" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."lead_activities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lead_activities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lead_payments" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."lead_payments" TO "authenticated";



GRANT ALL ON TABLE "public"."lead_updates" TO "service_role";
GRANT SELECT ON TABLE "public"."lead_updates" TO "authenticated";



GRANT UPDATE("is_seen") ON TABLE "public"."lead_updates" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."lead_updates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lead_updates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."leads" TO "authenticated";



GRANT ALL ON TABLE "public"."open_now_niche_cache" TO "service_role";
GRANT SELECT ON TABLE "public"."open_now_niche_cache" TO "authenticated";



GRANT ALL ON TABLE "public"."open_now_refresh_guard" TO "service_role";



GRANT ALL ON TABLE "public"."places_search_cache" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."places_search_cache" TO "authenticated";



GRANT ALL ON TABLE "public"."private_access" TO "service_role";
GRANT SELECT ON TABLE "public"."private_access" TO "authenticated";



GRANT ALL ON TABLE "public"."prompt_visual_reference_assets" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_visual_reference_sets" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_visual_references" TO "service_role";



GRANT ALL ON TABLE "public"."site_previews" TO "service_role";



GRANT ALL ON TABLE "public"."sync_internal_config" TO "service_role";






















