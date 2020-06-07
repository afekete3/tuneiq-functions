import * as admin from 'firebase-admin';

function getFirebaseApp() {
    return !admin.apps.length ? admin.initializeApp() : admin.app();
}

export {
    getFirebaseApp
};