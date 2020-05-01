# tuneiq-functions
Firebase functions for TuneIQ

## Prereqs to run locally 

1. Set up admin sdk
- follow "To set the environment variable:" - https://firebase.google.com/docs/admin/setup#windows

2. Get the environment config from firebase
-  run this command in the functions folder: firebase functions:config:get | ac .runtimeconfig.json (for powershell)

## Run locally
- run this command to start the emulator: firebase emulators:start 
- use the created url for the function to run the function


