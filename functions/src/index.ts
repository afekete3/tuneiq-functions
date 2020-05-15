import * as base64 from 'js-base64'
import * as functions from 'firebase-functions'
import * as axios from 'axios'
const cors = require('cors')({ origin: true });

// Types -- TODO: find a better place to put these
export type RoundDetails = {
    url: string
    tracks: GameTrack[]
}

export type GameTrack = {
    id: string,
    title: string,
    artists: string[],
    isAnswer: boolean,
}

export type GameDetails = {
    name: string,
    password: string,
    hostId: string,
    intermissionDuration: number,
    roundDuration: number,
    startTime: Date | null,
    genre: string,
    rounds: RoundDetails[],
    leaderBoard: {
        [id: string]: {
            name: string,
            score: number
        }
    }
}

export type SpotifyArtist = {
    id: string,
    name: string,
    //The Spotify URI for the artist
    uri: string
}

export type SpotifyTrack = {
    id: string,
    artists: SpotifyArtist[],
    duration_ms: number,
    explict: boolean,
    name: string,
    preview_url: string,
    uri: string,
}


exports.generateGameContent = functions.https.onRequest((request, response) => {
    return cors(request, response, () => {
        const gameGenre: string = String(request.query.genre);
        const hostId: string = String(request.query.hostId);
        const hostName: string = String(request.query.hostName);
        const gameName: string = String(request.query.name);
        const password: string = String(request.query.password);
        const gameRounds: number = Number(functions.config().gameconfig.number_of_rounds);
        const optionsPerRound: number = Number(functions.config().gameconfig.number_of_options);

        return getRoundDetails(gameGenre, gameRounds, optionsPerRound).then((roundDetails: RoundDetails[]) => {
            const gameDetails: GameDetails = {
                hostId: hostId,
                name: gameName,
                password: password,
                genre: gameGenre,
                rounds: roundDetails,
                intermissionDuration: NaN,
                roundDuration: NaN,
                startTime: null,
                leaderBoard: {
                    [hostId]: {
                        name: hostName,
                        score: 0
                    }
                }
            };
            response.send(gameDetails);
            return gameDetails;
        }).catch(error => {
            console.log(error);
            response.send(error);
            return Promise.reject(error);
        })
    })
})

function getRoundDetails(gameGenre: string, gameRounds: number, optionsPerRound: number) {
    return getSpotifyToken().then(res => {
        const access_token = res;
        return getSpotifyTracks(gameGenre, gameRounds, access_token, optionsPerRound).then((tracks: SpotifyTrack[]) => {
            const answers = [];

            // there is a chance that there will not be enough tracks with previews
            // TODO: add fallback logic to get more tracks with previews
            for (const track of tracks) {
                if (track.preview_url !== null) {
                    answers.push(
                        {
                            url: track.preview_url,
                            track: {
                                id: track.id,
                                title: String(track.name),
                                artists: track.artists.map(artist => artist.name),
                                isAnswer: true,
                            }
                        });
                };
                if (answers.length === gameRounds) {
                    break;
                };
            }

            //making round objects
            const gameRoundDetails: RoundDetails[] = [];
            // trackIndex should never get bigger then tracks.length
            let trackIndex: number = 0;
            for (let i = 0; i < gameRounds; i++) {
                const gameTracks: GameTrack[] = [];
                gameTracks.push(answers[i].track);
                while (trackIndex < tracks.length) {
                    // Make sure we don't add the answer track
                    if (answers.filter(answer => answer.track.id === tracks[trackIndex].id).length > 0) {
                        trackIndex++;
                        continue;
                    }

                    gameTracks.push({
                        id: tracks[trackIndex].id,
                        title: tracks[trackIndex].name,
                        artists: tracks[trackIndex].artists.map(artist => artist.name),
                        isAnswer: false
                    });

                    if (gameTracks.length === optionsPerRound) {
                        break;
                    }
                    trackIndex++;
                }

                gameRoundDetails.push({
                    url: answers[i].url,
                    tracks: gameTracks
                })
            }

            return gameRoundDetails;
        }).catch(error => {
            return Promise.reject(error);
        })

    }).catch(error => {
        return Promise.reject(error);
    })
}

function getSpotifyToken() {
    const spotifyTokenEndpoint = 'https://accounts.spotify.com/api/token';
    const clientId = functions.config().spotifykeys.client_id;
    const clientSecret = functions.config().spotifykeys.client_secret;
    const authorization64 = base64.Base64.encode(`${clientId}:${clientSecret}`);
    const spotifyTokenRequestConfig: axios.AxiosRequestConfig = {
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
    };
    return axios.default(spotifyTokenRequestConfig).then((response) => {
        return response.data.access_token;
    }).catch((error) => {
        console.log(error);
        return Promise.reject(error);
    })
}

function getSpotifyTracks(gameGenre: string, gameRounds: number, access_token: string, optionsPerRound: number) {
    // Adding an extra 10 tracks to lower the possibility of not getting enough previews
    const spotifyResultLimit = gameRounds * optionsPerRound + 10;
    const minPopularity = functions.config().gameconfig.min_popularity;
    const spotifyRecommendationEndpoint =
        `https://api.spotify.com/v1/recommendations?limit=${spotifyResultLimit}&seed_genres=${gameGenre}&min_popularity=${minPopularity}`;

    const spotifyRecommendationRequestConfig: axios.AxiosRequestConfig = {
        url: spotifyRecommendationEndpoint,
        method: 'get',
        headers: {
            "Accept": 'Accept: application/json',
            'Authorization': `Bearer ${access_token}`
        }
    };

    return axios.default(spotifyRecommendationRequestConfig).then(response => {
        const spotifyTracks: SpotifyTrack[] = [];
        response.data.tracks.forEach((track: any) => {
            spotifyTracks.push({
                id: track.id,
                artists: track.artists.map((artist: any) => {
                    return {
                        id: artist.id,
                        name: artist.name,
                        uri: artist.uri
                    }
                }),
                duration_ms: track.duration_ms,
                explict: track.explict,
                name: track.name,
                preview_url: track.preview_url,
                uri: track.uri,
            })
        });
        return spotifyTracks;
    }).catch(error => {
        return Promise.reject(error);
    })
}


