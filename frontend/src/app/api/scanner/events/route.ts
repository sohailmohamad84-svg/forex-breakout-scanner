export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(
        encoder.encode(`event: message\ndata: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`)
      );

      // Keep connection open with periodic heartbeat every 15s
      const interval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify({ type: 'HEARTBEAT', timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      // Clean up on close after 60 seconds (Vercel max serverless streaming time)
      setTimeout(() => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // ignore
        }
      }, 55000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
