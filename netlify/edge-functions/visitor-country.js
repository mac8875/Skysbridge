export default async (_request, { geo }) => {
  const countryCode = geo?.country?.code?.toUpperCase() ?? null;

  return Response.json(
    { countryCode },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
};

export const config = { path: "/api/visitor-country" };
