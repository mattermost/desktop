# src/main/diagnostics/ — Diagnostics Module

`DiagnosticsModule` runs sequential diagnostic steps, generates a markdown report, and opens the log file location. Triggered via **Help → Run diagnostics**.

Each step extends `DiagnosticStep` (with retry support and duration tracking) in `steps/`. Steps run sequentially; order matters if a step depends on earlier results.

To add a step: copy `steps/step.template.ts`, implement `run()`, and register it in `index.ts`.

## Extending diagnostics

### Example: adding a new step

```typescript
// steps/step12.myCheck.ts
import type {MainLogger} from 'electron-log';

import type {DiagnosticStepResponse} from 'types/diagnostics';

import DiagnosticsStep from '../DiagnosticStep';

const stepName = 'Step-12';
const stepDescriptiveName = 'myCheck';

const run = async (logger: MainLogger): Promise<DiagnosticStepResponse> => {
    try {
        // perform diagnostic check
        const result = await someCheck();
        return {
            message: `${stepName} finished successfully`,
            succeeded: result,
        };
    } catch (error) {
        logger.warn(`Diagnostics ${stepName} Failure`, {error});
        return {
            message: `${stepName} failed`,
            succeeded: false,
            payload: error,
        };
    }
};

const Step12 = new DiagnosticsStep({
    name: `diagnostic-${stepName}: ${stepDescriptiveName}`,
    retries: 0,
    run,
});

export default Step12;
```

Then import and add to `SORTED_STEPS` in `index.ts`. Step order matters — place it after any steps it depends on.
