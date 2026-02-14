#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9,<3.13"
# dependencies = [
#     "numpy<2",
#     "faiss-cpu",
#     "sentence-transformers",
#     "redis",
# ]
# ///
import sys
import os
import argparse
import json

# Add local library path
sys.path.append(os.path.join(os.path.dirname(__file__), "lib"))

try:
    from openmemory import OpenMemory, MemoryConfig
except ImportError:
    # If not found in lib, try importing from installed package or check path
    # This handles both development and production environments
    try:
        import openmemory
        OpenMemory = openmemory.OpenMemory
        MemoryConfig = openmemory.MemoryConfig
    except ImportError:
        print("Error: openmemory library not found. Please install requirements.", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="OpenMemory Skill CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Add command
    add_parser = subparsers.add_parser("add", help="Add a new memory")
    add_parser.add_argument("content", type=str, help="Memory content")
    add_parser.add_argument("--category", type=str, default="general", help="Memory category")
    add_parser.add_argument("--importance", type=float, default=0.5, help="Importance score (0.0-1.0)")

    # Search command
    search_parser = subparsers.add_parser("search", help="Search memories")
    search_parser.add_argument("query", type=str, help="Search query")
    search_parser.add_argument("--limit", type=int, default=5, help="Max results")

    # Context command
    context_parser = subparsers.add_parser("context", help="Get memory context")
    context_parser.add_argument("--max-tokens", type=int, default=1000, help="Max tokens for context")
    context_parser.add_argument("--user-id", type=str, default="default_user", help="User ID")

    # Extract command (new feature mentioned in docs)
    extract_parser = subparsers.add_parser("extract", help="Extract memories from text")
    extract_parser.add_argument("text", type=str, help="Text to extract from")
    
    # Handle single string argument case (e.g. from some agent tool invocations)
    raw_args = sys.argv[1:]
    if len(raw_args) == 1 and (' ' in raw_args[0] or raw_args[0] in ['context']):
        import shlex
        try:
            raw_args = shlex.split(raw_args[0])
        except ValueError:
            pass # Use as is if split fails

    args = parser.parse_args(raw_args)

    # Initialize memory system
    # We use a local directory for data storage by default
    data_dir = os.environ.get("OPENMEMORY_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
    os.makedirs(data_dir, exist_ok=True)
    
    # Initialize memory system
    # We use a local directory for data storage by default
    data_dir = os.environ.get("OPENMEMORY_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
    os.makedirs(data_dir, exist_ok=True)
    
    use_vector = True
    # Check if we can import vector store dependencies
    try:
        import numpy
        import faiss
        import sentence_transformers
    except ImportError:
        print("Warning: Vector store dependencies missing. Falling back to simple storage.", file=sys.stderr)
        use_vector = False
    except Exception as e:
        print(f"Warning: Error checking dependencies: {e}. Disabling vector store.", file=sys.stderr)
        use_vector = False

    try:
        config = MemoryConfig(base_path=data_dir, use_vector=use_vector)
        user_id = getattr(args, "user_id", "default_user") 
        mem = OpenMemory(config=config, user_id=user_id)
    except Exception as e:
        # If initialization failed (e.g. torch error inside OpenMemory), retry without vector
        if use_vector:
            print(f"Warning: Failed to initialize with vector store: {e}. Retrying without vector.", file=sys.stderr)
            config = MemoryConfig(base_path=data_dir, use_vector=False)
            mem = OpenMemory(config=config, user_id=user_id)
        else:
            raise e

    if args.command == "add":
        memory = mem.add(args.content, category=args.category, importance=args.importance)
        print(json.dumps({"status": "success", "id": memory.id, "content": memory.content}))

    elif args.command == "search":
        results = mem.search(args.query, limit=args.limit)
        # Convert memory objects to dicts for JSON output
        output = [{"id": m.id, "content": m.content, "score": getattr(m, "score", 0)} for m in results]
        print(json.dumps(output, indent=2))

    elif args.command == "context":
        # user_id is already in mem instance
        context = mem.get_context(max_tokens=args.max_tokens)
        print(json.dumps({"context": context}))

    elif args.command == "extract":
        # Placeholder for extraction if library supports it directly
        # For now, just add it as a raw memory
        memory = mem.add(args.text, category="extracted", importance=0.6)
        print(json.dumps({"status": "extracted", "id": memory.id, "content": memory.content}))

    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
