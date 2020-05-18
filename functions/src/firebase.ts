import * as admin from 'firebase-admin';

function getFirebaseApp() {
    return !admin.apps.length ? 
        admin.initializeApp({ 
            credential: admin.credential.applicationDefault(), 
            databaseURL: "https://tuneiq.firebaseio.com" 
        }) : 
        admin.app();
}

export {
    getFirebaseApp
};