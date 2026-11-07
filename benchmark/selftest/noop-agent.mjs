#!/usr/bin/env node
/**
 * A stand-in "agent" that changes nothing. Used by the self-test to exercise
 * run.mjs end to end without calling a model. It prints a result in Claude
 * Code's --output-format json shape so the metrics parser is exercised too.
 */
const prompt = process.argv.slice(2).join(' ');
process.stdout.write(
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    num_turns: 0,
    duration_ms: 0,
    total_cost_usd: 0,
    usage: {
      input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 0,
    },
    modelUsage: { noop: {} },
    result: `noop agent: ignored a ${prompt.length}-character prompt`,
  }) + '\n'
);
