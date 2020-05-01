const axios = require('axios');
const btoa = require('btoa')
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://tuneiq.firebaseio.com"
});

exports.createGame = functions.https.onRequest((request, response) => {
    const gameGenre = request.query.genre
    const hostId = request.query.hostId
    const gameName = request.query.name
    const password = request.query.password
    const gameRounds = functions.config().gameconfig.number_of_rounds
    const optionsPerRound = functions.config().gameconfig.number_of_options

    getRoundDetails(gameGenre, gameRounds, optionsPerRound).then(roundDetails => {
        gameDetails = {
            hostId: hostId,
            name: gameName,
            password: password,
            genre: gameGenre,
            roundDetails: roundDetails,
            playerScores: { [hostId]: 0 }
        }
        admin.firestore().collection("games").add(gameDetails).then(entry => {
            response.send(entry.id)
            return entry
        }).catch(err => {
            console.log(err)
            throw err
        })
        return gameDetails
    }).catch(err => {
        console.log(err)
        response.send(err)
        return err
    })
})

function getRoundDetails(gameGenre, gameRounds, optionsPerRound) {
    return getSpotifyToken().then(res => {
        const access_token = res
        return getSpotifyTracks(gameGenre, gameRounds, access_token, optionsPerRound).then(tracks => {
            const answerTracks = []

            // there is a chance that there will not be enough tracks with previews
            // TODO: add fallback logic to get more tracks with previews
            tracks.every(track => {
                if (track.preview_url !== null) {
                    answerTracks.push({
                        title: track.name,
                        artists: track.artists.map(artist => artist.name),
                        album: track.album.name,
                        previewUrl: track.preview_url
                    })
                }
                if (answerTracks.length === gameRounds) {
                    return false
                }
                return true
            })

            //making round objects
            const gameRoundDetails = []
            for (let i = 0; i < gameRounds; i++) {
                incorrectTracks = []
                for (let j = 0; j < tracks.length; j++) {
                    // Make sure we don't add the answer track
                    if (tracks[j] === answerTracks[i]) {
                        continue
                    }

                    incorrectTracks.push({
                        title: tracks[j].name,
                        artists: tracks[j].artists.map(artist => artist.name),
                        album: tracks[j].album.name
                    })

                    if (incorrectTracks.length === optionsPerRound - 1) {
                        break
                    }
                }

                gameRoundDetails.push({
                    answerTrack: answerTracks[i],
                    incorrectTracks: incorrectTracks
                })
            }

            return { rounds: gameRoundDetails }
        }).catch(err => {
            throw err
        })

    }).catch(err => {
        throw err
    })
}

function getSpotifyToken() {
    const spotifyTokenEndpoint = 'https://accounts.spotify.com/api/token'
    const clientId = functions.config().spotifykeys.client_id
    const clientSecret = functions.config().spotifykeys.client_secret
    const authorization64 = btoa(`${clientId}:${clientSecret}`)
    const spotifyTokenRequestConfig = {
        url: spotifyTokenEndpoint,
        method: 'post',
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authorization64}`
        },

        params:
        {
            grant_type: 'client_credentials'
        }
    }
    return axios(spotifyTokenRequestConfig).then(res => {
        return res.data.access_token
    }).catch(err => {
        console.log(err)
        throw err
    })
}

function getSpotifyTracks(gameGenre, gameRounds, access_token, optionsPerRound) {
    // Adding an extra 10 tracks to lower the possibility of not getting enough previews
    const spotifyResultLimit = gameRounds * optionsPerRound + 10
    const minPopularity = functions.config().gameconfig.min_popularity
    const spotifyRecommendationEndpoint =
        `https://api.spotify.com/v1/recommendations?limit=${spotifyResultLimit}&seed_genres=${gameGenre}&min_popularity=${minPopularity}`

    const spotifyRecommendationRequestConfig = {
        url: spotifyRecommendationEndpoint,
        method: 'get',
        headers: {
            "Accept": 'Accept: application/json',
            'Authorization': `Bearer ${access_token}`
        }
    }

    return axios(spotifyRecommendationRequestConfig).then(res => {
        return res.data.tracks
    }).catch(err => {
        throw err
    })
}


