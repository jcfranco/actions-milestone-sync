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
const core = __importStar(require("@actions/core"));
const github_1 = __importDefault(require("@actions/github"));
const semver_1 = __importDefault(require("semver"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput("repo-token", { required: true });
            const client = new github_1.default.GitHub(token);
            const { owner, repo } = github_1.default.context.repo;
            core.debug(`fetching open milestones`);
            const { data: milestones } = yield client.issues.listMilestones({
                owner,
                repo,
                state: "open"
            });
            const prereleaseId = "beta";
            const [latestSemverTaggedMilestone] = milestones.filter(({ title }) => title.includes(`-${prereleaseId}.`) && semver_1.default.valid(title)).sort(({ title: title1 }, { title: title2 }) => semver_1.default.rcompare(title1, title2));
            const currentMilestoneVersion = latestSemverTaggedMilestone.title;
            const nextMilestoneVersion = `v${semver_1.default.inc(currentMilestoneVersion, "prerelease", prereleaseId)}`;
            core.debug(`creating next milestone (${nextMilestoneVersion})`);
            const { data: nextMilestone } = yield client.issues.createMilestone({
                owner,
                repo,
                title: nextMilestoneVersion
            });
            core.debug(`moving open ${currentMilestoneVersion} issues to ${nextMilestoneVersion}`);
            const { data: currentMilestoneOpenIssues } = yield client.issues.get({
                owner,
                repo,
                state: "open",
                milestone: latestSemverTaggedMilestone.number
            });
            yield Promise.all(currentMilestoneOpenIssues.map(({ number: issue_number }) => client.issues.update({
                owner,
                repo,
                issue_number,
                milestone: nextMilestone.number
            })));
            core.debug(`moving open ${currentMilestoneVersion} pulls to ${nextMilestoneVersion}`);
            const { data: allOpenPulls } = yield client.pulls.get({
                owner,
                repo,
                state: "open"
            });
            // we do this since the REST API doesn't allow milestone filtering
            const currentMilestoneOpenPulls = allOpenPulls.filter(({ milestone: { number } }) => number === latestSemverTaggedMilestone.number);
            yield Promise.all(currentMilestoneOpenPulls.map(({ number: issue_number }) => client.issues.update({
                owner,
                repo,
                issue_number,
                milestone: nextMilestone.number
            })));
            core.debug(`closing milestone ${currentMilestoneVersion}`);
            yield client.issues.updateMilestone({
                owner,
                repo,
                title: currentMilestoneVersion,
                state: "closed"
            });
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
run();
