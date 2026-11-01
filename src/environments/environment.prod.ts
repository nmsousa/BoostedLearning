export const environment = {
  production: true,
  // Cloudflare Worker endpoint that creates a GitHub issue from a feedback
  // report. Leave empty to fall back to a mailto: report. Fill in after
  // deploying the worker (see worker/README.md).
  feedbackEndpoint: '',
};
