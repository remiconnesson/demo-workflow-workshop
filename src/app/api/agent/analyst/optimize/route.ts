export async function POST() {
  return Response.json(
    {
      error: "deprecated",
      message: "Use the analyst chat workflow; Lucky now starts one durable proposal turn.",
    },
    { status: 410 },
  );
}
