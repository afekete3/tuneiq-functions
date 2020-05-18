import * as admin from 'firebase-admin';

// TODO: convert this to typescript
const serviceAccount = require("../../.tuneiq-firebase-adminsdk-key.json");

function getFirebaseApp() {
    return !admin.apps.length ? 
        admin.initializeApp({ 
            credential: admin.credential.applicationDefault(serviceAccount), 
            databaseURL: "https://tuneiq.firebaseio.com" 
        }) : 
        admin.app();
}

export {
    getFirebaseApp
};