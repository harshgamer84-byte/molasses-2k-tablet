# Cline Skills — Termux Remotion Rendering

This directory contains automatic skills/plugins for Cline to use when working with Remotion projects on Android Termux.

## Available Skills

### 1. **Termux Remotion Auto-Optimizer** (`termux-remotion-optimizer.md`)
Automatically patches Remotion projects for tablet rendering:
- Fixes WebGL backend (`--gl=swangle`)
- Adds audio muting (`--muted`)
- Optimizes ThreeCanvas settings
- Validates environment

**Trigger:** When user mentions render/remotion/tablet or provides a Remotion project folder

## How It Works

Cline reads skill files on startup and activates them based on:
- **Context triggers** (keywords, environment, file patterns)
- **Priority** (high/medium/low)
- **Validation rules** (prerequisites, environment checks)

When activated, skills run automatically in the background and report results to the user.

## Adding New Skills

Create a new `.md` file in this directory with frontmatter:

```markdown
---
name: Skill Name
trigger: when to activate
priority: high|medium|low
---

# Skill Description
...
```

## Current Project: Molasses 2K

The optimizer was created for the Molasses Short 2K tablet render (`~/m2k`) and is now available for all Remotion projects in Termux.

**Status:** Deployed and active  
**Last Updated:** 2026-11-12
