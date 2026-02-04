---
description: Advanced brainstorming workflow using Sequential Thinking and Obsidian integration
---

# Brainstorming Workflow

Trigger this workflow with `/brainstorm [topic]` to generate ideas, explore concepts deeply using Sequential Thinking, and save the results to your Obsidian vault.

## Steps

1. **Context Setup**
   - The user provides a topic.
   - If no topic is provided, ask: "What topic would you like to brainstorm today?"

2. **Deep Exploration (Sequential Thinking)**
   - Use the `sequential-thinking` tool to explore the topic.
   - **Thought Process**:
     - Start with a broad overview.
     - Break down into sub-topics or branches.
     - Question assumptions.
     - Generate creative/divergent ideas.
     - Synthesize into actionable insights.
   - **Goal**: Produce a comprehensive analysis and a structured list of ideas.

3. **Structure & Visualization**
   - Organize the thoughts into a hierarchy.
   - Generate a Mermaid.js mind map visualization of the key concepts.
   - Format:
     ```mermaid
     graph TD
       Root[Topic] --> Branch1[Key Concept 1]
       Root --> Branch2[Key Concept 2]
       Branch1 --> Leaf1[Detail]
       ...
     ```

4. **Obsidian Integration**
   - Create a new note in the Obsidian vault (default path or `Inbox/`).
   - Use the `obsidian-pkm.md` principles or directly call the creation script if available (e.g., via `run_command`).
   - **File Content**:
     - Title: `Brainstorm - [Topic] - [Date]`
     - Frontmatter:
       ```yaml
       tags: [brainstorm, idea, [topic-tags]]
       date: [Current Date]
       ```
     - Body:
       - **Summary**: Brief overview.
       - **Mind Map**: The Mermaid diagram.
       - **Details**: The structured list of ideas from the sequential thinking process.
       - **Next Steps**: Actionable items.

5. **Completion**
   - Output a link to the created Obsidian note (if file path is known).
   - Show the summary and mind map in the chat.

## Example

User: `/brainstorm "AI Agents for Personal Productivity"`

Agent:
1. Uses `sequential-thinking` to analyze AI agents, productivity bottlenecks, automation, vs. augmentation.
2. Generates a mind map.
3. Creates file: `LongBest/Inbox/Brainstorm - AI Agents for Personal Productivity.md`.
4. Adds tags: `#brainstorm #ai #productivity`.
5. Responds with "Brainstorming session saved to Obsidian. Here is the mind map..."
