import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import semver from "semver";

async function run(): Promise<void> {
  try {
    const token = core.getInput("repo-token", { required: true });
    const client = getOctokit(token);
    const { owner, repo } = context.repo;

    core.info(`fetching open milestones`);

    const { data: milestones } = await client.issues.listMilestones({
      owner,
      repo,
      state: "open"
    });

    const prereleaseId = "beta";
    const [latestSemverTaggedMilestone] = milestones.filter(({ title }) => title.includes(`-${prereleaseId}.`) && semver.valid(title)).sort(({ title: title1 }, { title: title2 }) => semver.rcompare(title1, title2));
    const currentMilestoneVersion = latestSemverTaggedMilestone.title;
    const nextMilestoneVersion = `v${semver.inc(currentMilestoneVersion, "prerelease", prereleaseId)}`;
    const resultThreshold = 100;

    core.debug(`
      release ID: ${prereleaseId}
      current milestone: ${currentMilestoneVersion}
      next milestone: ${nextMilestoneVersion}
    `);

    core.info(`creating next milestone (${nextMilestoneVersion})`);

    const { data: nextMilestone } = await client.issues.createMilestone({
      owner,
      repo,
      title: nextMilestoneVersion
    });

    core.debug("next milestone created");

    const { data: currentMilestoneOpenIssues } = await client.issues.list({
      owner,
      repo,
      state: "open",
      milestone: latestSemverTaggedMilestone.number,
      per_page: resultThreshold
    });

    core.info(`moving ${currentMilestoneOpenIssues.length + 1} open ${currentMilestoneVersion} issue(s) to ${nextMilestoneVersion}`);

    for (let { number: issue_number } of currentMilestoneOpenIssues) {
      await client.issues.update({
        owner,
        repo,
        issue_number,
        milestone: nextMilestone.number
      });
    }

    core.debug("open issues moved");

    core.debug("fetching open pull requests");

    const { data: allOpenPulls } = await client.pulls.list({
      owner,
      repo,
      state: "open"
    });

    // we do this since the REST API doesn't allow milestone filtering
    const currentMilestoneOpenPulls = allOpenPulls.filter(({ milestone }) => milestone?.number === latestSemverTaggedMilestone.number);

    core.info(`moving open ${currentMilestoneOpenPulls.length + 1} ${currentMilestoneVersion} pull(s) to ${nextMilestoneVersion}`);

    for (let { number: issue_number } of currentMilestoneOpenPulls) {
      await client.issues.update({
        owner,
        repo,
        issue_number,
        milestone: nextMilestone.number
      });
    }

    core.debug("open pull requests moved");

    core.info(`closing milestone ${currentMilestoneVersion}`);

    await client.issues.updateMilestone({
      owner,
      repo,
      milestone_number: latestSemverTaggedMilestone.number,
      state: "closed"
    });

    core.debug("milestone closed");

  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
