

## Add LinkedIn Profile URLs to AI Competitor Suggestions

### What changes

**1. Update the prompt** in `supabase/functions/suggest-competitors/index.ts` to ask the AI to also return each competitor's LinkedIn profile URL.

**2. Update the tool schema** in the same function to include a `linkedin_url` field in the returned objects.

**3. Deploy the updated edge function.**

### Technical details

- In the prompt, add: "Also include each competitor's LinkedIn profile URL if known."
- In the tool call schema (lines 80-90), add `linkedin_url: { type: 'string', description: 'LinkedIn profile URL' }` to the item properties and to the `required` array.
- The `Competitor` type in `src/types/clients.ts` already has an optional `linkedin_url` field, so no client-side type changes are needed.
- The UI that renders competitor cards already handles `linkedin_url` if present, so suggestions will auto-populate the LinkedIn field when accepted.

### Caveat

The AI model will attempt to construct LinkedIn URLs based on its training data. These URLs may not always be accurate (LinkedIn profiles can change). A note could be shown to users to verify the URLs, but this is optional.

