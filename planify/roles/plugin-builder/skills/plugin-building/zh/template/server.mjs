import { createStdioServer } from "@pibot/plugin-sdk";

const { server, transport } = createStdioServer("my-plugin", "0.0.1");
server.registerTool(
  "hello",
  {
    description: "Return a fixed greeting without reading or writing any data",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async () => ({ content: [{ type: "text", text: "hello" }] }),
);
await server.connect(transport);
