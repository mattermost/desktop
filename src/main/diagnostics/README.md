# Desktop Diagnostics

This directory contains the code for running the diagnostics of the desktop application. (entrypoint `index.ts`)
This readme file's purpose is to explain the code, the structure and how to contribute to it.

## How it works?

The class `DiagnosticsModule` in `index.ts` is the "orchestrator" that runs specific steps/tasks one at a time. It keeps track of whether or not a specific
step has succeeded or not and stores the return values of the steps.

## Diagnostics Steps

The diagnostic steps at this moment are:

| Step | Name | Description |
| :---: | :---: | :--- |
| 0 | logger | Validates that the diagnostics write to the correct file and the log level is "debug" |

## Future enhancements

- Run steps in parallel (if necessary)
- Background diagnostics monitoring
