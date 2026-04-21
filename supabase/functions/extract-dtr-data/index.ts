import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "employee",
    "cutoff",
    "daily_rows",
    "totals",
    "low_confidence_fields",
    "overall_confidence",
    "notes",
  ],
  properties: {
    employee: {
      type: "object",
      additionalProperties: false,
      required: ["name", "employee_id", "location", "branch"],
      properties: {
        name: { type: "string" },
        employee_id: { type: "string" },
        location: { type: "string" },
        branch: { type: "string" },
      },
    },
    cutoff: {
      type: "object",
      additionalProperties: false,
      required: ["label", "selected_dtr_date"],
      properties: {
        label: { type: "string" },
        selected_dtr_date: { type: "string" },
      },
    },
    daily_rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "date",
          "day",
          "time_in",
          "time_out",
          "break_hours",
          "regular_hours",
          "overtime_hours",
          "late_minutes",
          "undertime_minutes",
          "absence",
          "remarks",
          "confidence",
        ],
        properties: {
          date: { type: "string" },
          day: { type: "string" },
          time_in: { type: "string" },
          time_out: { type: "string" },
          break_hours: { type: "number" },
          regular_hours: { type: "number" },
          overtime_hours: { type: "number" },
          late_minutes: { type: "number" },
          undertime_minutes: { type: "number" },
          absence: { type: "boolean" },
          remarks: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    totals: {
      type: "object",
      additionalProperties: false,
      required: [
        "days_present",
        "regular_hours",
        "overtime_hours",
        "late_minutes",
        "undertime_minutes",
        "absences",
      ],
      properties: {
        days_present: { type: "number" },
        regular_hours: { type: "number" },
        overtime_hours: { type: "number" },
        late_minutes: { type: "number" },
        undertime_minutes: { type: "number" },
        absences: { type: "number" },
      },
    },
    low_confidence_fields: {
      type: "array",
      items: { type: "string" },
    },
    overall_confidence: { type: "number" },
    notes: { type: "string" },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getOutputText(response: Record<string, any>) {
  if (typeof response.output_text === "string") return response.output_text;

  const chunks: string[] = [];
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function getConfidence(extractedData: Record<string, any>) {
  const value = Number(extractedData?.overall_confidence);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_DTR_MODEL") || "gpt-4.1-mini";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase server environment is not configured." }, 500);
  }

  const authHeader = request.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt);

  if (userError || !user) {
    return jsonResponse({ error: "Invalid session." }, 401);
  }

  let body: { submission_id?: string };
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!body.submission_id) {
    return jsonResponse({ error: "submission_id is required." }, 400);
  }

  const { data: submission, error: submissionError } = await supabase
    .from("dtr_submissions")
    .select(`
      id,
      user_id,
      cutoff,
      selected_dtr_date,
      file_url,
      status,
      profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name, employee_id, location, branch)
    `)
    .eq("id", body.submission_id)
    .maybeSingle();

  if (submissionError) {
    return jsonResponse({ error: submissionError.message }, 500);
  }

  if (!submission) {
    return jsonResponse({ error: "DTR submission not found." }, 404);
  }

  const [{ data: isAdmin }, { data: isSupervisor }] = await Promise.all([
    supabase.rpc("is_admin", { check_user_id: user.id }),
    supabase.rpc("is_supervisor_for_employee", {
      target_user_id: submission.user_id,
      check_user_id: user.id,
    }),
  ]);
  const canAccess = submission.user_id === user.id || Boolean(isAdmin) || Boolean(isSupervisor);
  if (!canAccess) {
    return jsonResponse({ error: "You do not have access to this DTR submission." }, 403);
  }

  await supabase.from("dtr_extractions").upsert(
    {
      submission_id: submission.id,
      source_file_url: submission.file_url,
      status: "processing",
      extracted_data: {},
      confidence_score: null,
      verified_by_user_id: null,
      verified_at: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "submission_id" },
  );

  if (!openAiKey) {
    const errorMessage = "OPENAI_API_KEY is not configured for the extract-dtr-data function.";
    await supabase
      .from("dtr_extractions")
      .update({
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submission.id);
    return jsonResponse({ status: "failed", error: errorMessage }, 200);
  }

  const { data: signedFile, error: signedUrlError } = await supabase.storage
    .from("dtr-images")
    .createSignedUrl(submission.file_url, 60 * 20);

  if (signedUrlError || !signedFile?.signedUrl) {
    const errorMessage = signedUrlError?.message || "Unable to create signed DTR image URL.";
    await supabase
      .from("dtr_extractions")
      .update({
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submission.id);
    return jsonResponse({ status: "failed", error: errorMessage }, 200);
  }

  const prompt = [
    "Extract payroll data from this standard security guard DTR image.",
    "Return JSON only using the provided schema.",
    "The result is a draft for human review, so do not invent unreadable values.",
    "Use blank strings and zeroes for unreadable fields, and list uncertain fields in low_confidence_fields.",
    "Compute totals from visible rows when possible.",
    `Known employee name: ${submission.profiles?.full_name || ""}`,
    `Known employee ID: ${submission.profiles?.employee_id || ""}`,
    `Known location: ${submission.profiles?.location || ""}`,
    `Known branch: ${submission.profiles?.branch || ""}`,
    `Selected cutoff: ${submission.cutoff || ""}`,
    `Selected DTR date: ${submission.selected_dtr_date || ""}`,
  ].join("\n");

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: signedFile.signedUrl,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "dtr_payroll_extraction",
            strict: true,
            schema: EXTRACTION_SCHEMA,
          },
        },
      }),
    });

    const responseJson = await openAiResponse.json();
    if (!openAiResponse.ok) {
      throw new Error(responseJson?.error?.message || "OpenAI extraction request failed.");
    }

    const outputText = getOutputText(responseJson);
    const extractedData = JSON.parse(outputText);
    const confidenceScore = getConfidence(extractedData);
    const nextStatus = confidenceScore !== null && confidenceScore < 0.65 ? "needs_review" : "draft";

    const { data: extraction, error: updateError } = await supabase
      .from("dtr_extractions")
      .update({
        status: nextStatus,
        extracted_data: extractedData,
        confidence_score: confidenceScore,
        verified_by_user_id: null,
        verified_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submission.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      status: nextStatus,
      extraction,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unable to extract DTR data.";
    await supabase
      .from("dtr_extractions")
      .update({
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("submission_id", submission.id);

    return jsonResponse({ status: "failed", error: errorMessage }, 200);
  }
});
