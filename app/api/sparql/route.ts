import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const query = formData.get("query");

    if (!query) {
      return NextResponse.json({ error: "No query provided" }, { status: 400 });
    }

    console.log("Sending SPARQL query:", query);

    const sparqlResponse = await fetch("https://statistics.gov.scot/sparql", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: `query=${encodeURIComponent(query as string)}`,
    });

    if (!sparqlResponse.ok) {
      const errorText = await sparqlResponse.text();
      console.error("SPARQL endpoint error:", {
        status: sparqlResponse.status,
        statusText: sparqlResponse.statusText,
        body: errorText,
      });

      return NextResponse.json(
        {
          error: "SPARQL endpoint error",
          details: {
            status: sparqlResponse.status,
            statusText: sparqlResponse.statusText,
            body: errorText,
          },
        },
        { status: sparqlResponse.status }
      );
    }

    const data = await sparqlResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("SPARQL proxy error:", error);

    // More detailed error response
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
