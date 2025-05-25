# GitHub Webhook Setup Guide

This guide explains how to set up the GitHub webhook endpoint for the review apps system.

## Overview

The webhook endpoint at `/api/webhooks/github` receives GitHub pull request events and triggers deployment previews.

## Supported Events

- **pull_request**
  - `opened` - Creates a new deployment preview
  - `synchronize` - Updates existing deployment with new commits
  - `reopened` - Recreates deployment preview
  - `closed` - Cleans up deployment resources

## Configuration

### 1. Environment Variables

Add the following to your `.env` file:

```env
# GitHub Webhook Secret (generate a secure random string)
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

### 2. GitHub App/Webhook Configuration

In your GitHub App settings or repository webhook settings:

1. **Webhook URL**: `https://your-domain.com/api/webhooks/github`
2. **Content Type**: `application/json`
3. **Secret**: Use the same value as `GITHUB_WEBHOOK_SECRET`
4. **Events**: Select "Pull requests"

### 3. Security

The webhook endpoint implements the following security measures:

- **Signature Verification**: All requests are verified using HMAC-SHA256
- **Event Filtering**: Only processes supported pull request events
- **Timing-Safe Comparison**: Prevents timing attacks on signature verification

## Testing

### Local Testing

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Use the test script:
   ```bash
   npx tsx scripts/test-webhook.ts
   ```

### Using ngrok for GitHub Integration

1. Install ngrok:
   ```bash
   npm install -g ngrok
   ```

2. Start ngrok tunnel:
   ```bash
   ngrok http 3000
   ```

3. Use the ngrok URL for your GitHub webhook:
   ```
   https://abc123.ngrok.io/api/webhooks/github
   ```

## Webhook Payload

The webhook expects GitHub's standard pull request event payload:

```json
{
  "action": "opened",
  "number": 1,
  "pull_request": {
    "number": 1,
    "title": "Feature: Add new functionality",
    "head": {
      "ref": "feature-branch",
      "sha": "abc123...",
      "repo": {
        "full_name": "owner/repo",
        "clone_url": "https://github.com/owner/repo.git"
      }
    }
  },
  "repository": {
    "full_name": "owner/repo"
  }
}
```

## Troubleshooting

### Invalid Signature Error

- Ensure `GITHUB_WEBHOOK_SECRET` matches the secret in GitHub
- Check that you're using the correct header: `X-Hub-Signature-256`

### Webhook Not Triggering

- Verify the webhook URL is accessible from the internet
- Check GitHub webhook delivery logs for errors
- Ensure pull request events are enabled

### Development Tips

- Use the GET endpoint to verify the webhook is running: `GET /api/webhooks/github`
- Check server logs for detailed webhook processing information
- GitHub provides webhook delivery history in repository settings

## Next Steps

After setting up the webhook receiver, you'll need to:

1. Implement deployment job processing
2. Set up Fly.io integration for creating preview apps
3. Add PR comment posting functionality
4. Configure project settings and environment variables