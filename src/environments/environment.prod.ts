export const environment = {
  production: true,
  // Cloudflare Worker endpoint that creates a GitHub issue from a feedback
  // report. Leave empty to fall back to a mailto: report. (See worker/README.md.)
  feedbackEndpoint: 'https://boostionary-feedback.nmsousa.workers.dev/',
};
