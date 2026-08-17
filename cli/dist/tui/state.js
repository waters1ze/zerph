let state = {
    screen: 'repl',
    userData: null,
    mascotMood: 'idle',
    wingFrame: 0,
    ctrlCCount: 0,
    offlineMode: false,
    focusMinutes: 25,
};
const listeners = new Set();
export function getReplState() {
    return state;
}
export function updateReplState(patch) {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn(state));
    return state;
}
export function setScreen(screen) {
    updateReplState({ screen });
}
export function setMascotMood(mascotMood) {
    updateReplState({ mascotMood });
}
export function subscribeReplState(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
