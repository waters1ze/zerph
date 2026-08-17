import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Repl } from './Repl.js';
import { TodayScreen } from './commands/today.js';
import { CalendarScreen } from './commands/calendar.js';
import { FocusScreen } from './commands/focus.js';
import { ModelScreen } from './commands/model.js';
import { SettingsScreen } from './commands/settings.js';
import { FriendsScreen } from './commands/friends.js';
import { LimitsScreen } from './commands/limits.js';
import { StatsScreen } from './commands/stats.js';
import { HelpScreen } from './commands/help.js';
import { ExtensionsScreen } from './commands/extensions.js';
import { getReplState, subscribeReplState, updateReplState } from './state.js';
import { fetchUserData, loadCredentials } from '../api.js';
import { loadInstalledExtensions } from '../extensions/loader.js';
export function App({ initialData }) {
    const [data, setData] = useState(initialData || null);
    const [screen, setScreenState] = useState(getReplState().screen);
    const [focusMins, setFocusMins] = useState(getReplState().focusMinutes);
    const reloadData = async () => {
        try {
            const creds = loadCredentials();
            if (creds.token) {
                const res = await fetchUserData(creds);
                if (res.allowed !== false) {
                    setData(res);
                    updateReplState({ userData: res });
                }
            }
        }
        catch { }
    };
    useEffect(() => {
        if (initialData) {
            updateReplState({ userData: initialData });
        }
        else {
            reloadData();
        }
        const unsub = subscribeReplState(s => {
            setScreenState(s.screen);
            setFocusMins(s.focusMinutes);
        });
        // Init extensions runtime
        loadInstalledExtensions({
            api: {
                getTasks: async () => data?.tasks || [],
                createTask: async (title) => ({ title }),
                getNotes: async () => data?.notes || [],
                createNote: async (title, body) => ({ title, body }),
            },
            log: {
                info: (msg) => console.log(msg),
                success: (msg) => console.log(msg),
                error: (msg) => console.error(msg),
            },
            config: {
                get: () => null,
                set: () => { },
            },
        }).catch(() => { });
        return unsub;
    }, []);
    switch (screen) {
        case 'today':
            return _jsx(TodayScreen, { userData: data, onRefresh: reloadData });
        case 'cal':
            return _jsx(CalendarScreen, { userData: data });
        case 'focus':
            return _jsx(FocusScreen, { minutes: focusMins, userData: data, onComplete: reloadData });
        case 'model':
            return _jsx(ModelScreen, {});
        case 'settings':
            return _jsx(SettingsScreen, { userData: data });
        case 'friends':
            return _jsx(FriendsScreen, { userData: data });
        case 'limits':
            return _jsx(LimitsScreen, { userData: data });
        case 'stats':
            return _jsx(StatsScreen, { userData: data });
        case 'help':
            return _jsx(HelpScreen, { userData: data });
        case 'extensions':
            return _jsx(ExtensionsScreen, { userData: data });
        case 'repl':
        default:
            return _jsx(Repl, { userData: data, onRefresh: reloadData });
    }
}
