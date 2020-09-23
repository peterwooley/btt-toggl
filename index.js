#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
// @ts-ignore
const token = __importStar(require("./token.json"));
const moment = __importStar(require("moment"));
require("moment-duration-format");
const apiKey = token.api_token;
const currentFileName = __dirname + '/current.json';
const inactiveIcon = __dirname + '/inactive.png';
const activeIcon = __dirname + '/active.png';
const limit = 32;
let authConfig = {
    username: apiKey,
    password: 'api_token'
};
let jsonHeader = { 'Content-encoding': 'application/json' };
function requestConfig(url, method = 'GET', additionalHeaders = {}) {
    return {
        method: method,
        url: url,
        auth: authConfig,
        headers: additionalHeaders
    };
}
function saveEntry(entry) {
    fs.writeFileSync(currentFileName, JSON.stringify(entry, null, 2));
}
function getCurrentTimeEntry() {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        let config = requestConfig('https://www.toggl.com/api/v8/time_entries/current');
        const result = yield axios_1.default(config);
        let entry = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.data;
        if (entry) {
            let projectConfig = requestConfig('https://api.track.toggl.com/api/v8/projects/' + entry.pid);
            const projectResult = yield axios_1.default(projectConfig);
            let projectEntry = (_b = projectResult === null || projectResult === void 0 ? void 0 : projectResult.data) === null || _b === void 0 ? void 0 : _b.data;
            entry.project = projectEntry.name;
            let clientConfig = requestConfig('https://api.track.toggl.com/api/v8/clients/' + projectEntry.cid);
            const clientResult = yield axios_1.default(clientConfig);
            let clientEntry = (_c = clientResult === null || clientResult === void 0 ? void 0 : clientResult.data) === null || _c === void 0 ? void 0 : _c.data;
            entry.client = clientEntry.name;
        }
        saveEntry(entry);
        return entry;
    });
}
function getLastMeaningfulTimeEntry() {
    return __awaiter(this, void 0, void 0, function* () {
        let config = requestConfig('https://www.toggl.com/api/v8/time_entries');
        const result = yield axios_1.default(config);
        let entries = result.data;
        let meaningfulEntries = entries.filter((entry) => Boolean(entry.description)
            && entry.description != "Pomodoro Break");
        return meaningfulEntries[meaningfulEntries.length - 1];
    });
}
function startATimeEntry() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const current = JSON.parse(fs.readFileSync(currentFileName).toString());
        const entry = {
            time_entry: {
                tags: ['automated', 'touchbar'],
                created_with: 'curl',
                billable: true
            }
        };
        if (current) {
            let timeEntry = entry.time_entry;
            timeEntry.pid = current.pid;
            timeEntry.wid = current.wid;
            timeEntry.description = current.description;
            timeEntry.tags = current.tags;
        }
        let config = requestConfig('https://www.toggl.com/api/v8/time_entries/start', 'POST', jsonHeader);
        config["data"] = entry;
        const result = yield axios_1.default(config);
        return (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.data;
    });
}
function stopATimeEntry(current) {
    return __awaiter(this, void 0, void 0, function* () {
        yield axios_1.default(requestConfig(`https://www.toggl.com/api/v8/time_entries/${current.id}/stop`, 'PUT', jsonHeader));
    });
}
function truncated(str) {
    let dots = "...";
    let prefix = str.substr(0, limit);
    let suffix = str.substr(limit);
    return prefix + (suffix.length > dots.length ? dots : suffix);
}
/**
 * API returns duration but it's not very useful, as it does not represent duration of current entry.
 * In running entry it represents "negative value, denoting the start of the time entry in seconds since epoch"
 * But it also is not kept in sync with start time if that one is updated.
 */
function getDuration(current) {
    let start = Date.parse(current.start);
    const duration = moment.duration(Date.now().valueOf() - start.valueOf());
    return duration.format("h:mm", { trim: false });
}
function generateStatus(entry = null) {
    return __awaiter(this, void 0, void 0, function* () {
        let current = entry;
        if (current == null) {
            current = yield getCurrentTimeEntry();
        }
        let statusText = '-';
        let icon = inactiveIcon;
        if (current) {
            icon = activeIcon;
            statusText = `${getDuration(current)} ${current.project} • ${current.client} ${truncated(current.description)}`;
        }
        return {
            text: statusText,
            background_color: '0, 0, 0, 0',
            icon_path: icon
        };
    });
}
function toggle() {
    return __awaiter(this, void 0, void 0, function* () {
        const current = yield getCurrentTimeEntry();
        if (current) {
            yield stopATimeEntry(current);
            return yield generateStatus();
        }
        else {
            let entry = yield getLastMeaningfulTimeEntry();
            saveEntry(entry);
            const timeEntry = yield startATimeEntry();
            return yield generateStatus(timeEntry);
        }
    });
}
let outputResult = (status) => console.log(JSON.stringify(status));
if (process.argv.indexOf('toggle') !== -1) {
    toggle().then(outputResult);
}
else {
    generateStatus().then(outputResult);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0Esa0RBQStDO0FBQy9DLHVDQUF3QjtBQUN4QixhQUFhO0FBQ2Isb0RBQXFDO0FBQ3JDLCtDQUFpQztBQUNqQyxrQ0FBZ0M7QUFFaEMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQTtBQUM5QixNQUFNLGVBQWUsR0FBRyxTQUFTLEdBQUcsZUFBZSxDQUFBO0FBRW5ELE1BQU0sWUFBWSxHQUFHLFNBQVMsR0FBRyxlQUFlLENBQUE7QUFDaEQsTUFBTSxVQUFVLEdBQUcsU0FBUyxHQUFHLGFBQWEsQ0FBQTtBQUU1QyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUE7QUFjaEIsSUFBSSxVQUFVLEdBQUc7SUFDYixRQUFRLEVBQUUsTUFBTTtJQUNoQixRQUFRLEVBQUUsV0FBVztDQUN4QixDQUFBO0FBRUQsSUFBSSxVQUFVLEdBQUcsRUFBQyxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBQyxDQUFBO0FBRXpELFNBQVMsYUFBYSxDQUNsQixHQUFXLEVBQ1gsU0FBaUIsS0FBSyxFQUN0QixvQkFBeUIsRUFBRTtJQUUzQixPQUFPO1FBQ0gsTUFBTSxFQUFFLE1BQU07UUFDZCxHQUFHLEVBQUUsR0FBRztRQUNSLElBQUksRUFBRSxVQUFVO1FBQ2hCLE9BQU8sRUFBRSxpQkFBaUI7S0FDN0IsQ0FBQTtBQUNMLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxLQUFnQjtJQUMvQixFQUFFLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyRSxDQUFDO0FBRUQsU0FBZSxtQkFBbUI7OztRQUM5QixJQUFJLE1BQU0sR0FBRyxhQUFhLENBQUMsbURBQW1ELENBQUMsQ0FBQTtR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