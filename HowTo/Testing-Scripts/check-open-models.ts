#!/usr/bin/env tsx

import { openRouterModels } from '../server/config/openrouter-models';

console.log('=== OpenRouter Model Configuration ===\n');

// Show enabled models
console.log('✅ ENABLED MODELS:');
const enabledModels = openRouterModels.filter(m => m.enabled);
enabledModels.forEach(model => {
  console.log(`  - ${model.name} (${model.provider})`);
  console.log(`    ID: ${model.id}`);
  console.log(`    Priority: ${model.priority}`);
  console.log(`    Use Cases: ${model.useCase.join(', ')}`);
  console.log(`    Cost Limit: $${model.costLimit}`);
  console.log('');
});

// Show disabled models
console.log('\n❌ DISABLED MODELS:');
const disabledModels = openRouterModels.filter(m => !m.enabled);
disabledModels.forEach(model => {
  console.log(`  - ${model.name} (${model.provider}) - ${model.id}`);
});

console.log('\n=== Summary ===');
console.log(`Total enabled: ${enabledModels.length}`);
console.log(`Total disabled: ${disabledModels.length}`);
console.log(`Only open models active: ${enabledModels.every(m => 
  ['Meta', 'Mistral', 'Google', 'NousResearch', 'Teknium'].includes(m.provider)
)}`);