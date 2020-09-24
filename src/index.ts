import * as core from "@actions/core";
import github, { getOctokit } from "@actions/github";
import semver from "semver";

async function run(): Promise<void> {
  try {
    const token = core.getInput("repo-token", { required: true });
    const client = getOctokit(token);
    const { owner, repo } = github.context.repo;

    core.debug(`fetching open milestones`);

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

    core.debug(`creating next milestone (${nextMilestoneVersion})`);

    const { data: nextMilestone } = await client.issues.createMilestone({
      owner,
      repo,
      title: nextMilestoneVersion
    });

    core.debug(`moving open ${currentMilestoneVersion} issues to ${nextMilestoneVersion}`);

    const { data: currentMilestoneOpenIssues } = await client.issues.list({
      owner,
      repo,
      state: "open",
      milestone: latestSemverTaggedMilestone.number,
      per_page: resultThreshold
    });

    await Promise.all(currentMilestoneOpenIssues.map(({ number: issue_number }) =>
      client.issues.update({
        owner,
        repo,
        issue_number,
        milestone: nextMilestone.number
      })
    ));

    core.debug(`moving open ${currentMilestoneVersion} pulls to ${nextMilestoneVersion}`);

    const { data: allOpenPulls } = await client.pulls.list({
      owner,
      repo,
      state: "open"
    });

    // we do this since the REST API doesn't allow milestone filtering
    const currentMilestoneOpenPulls = allOpenPulls.filter(({ milestone: { number } }) => number === latestSemverTaggedMilestone.number);

    await Promise.all(currentMilestoneOpenPulls.map(({ number: issue_number }) =>
      client.issues.update({
        owner,
        repo,
        issue_number,
        milestone: nextMilestone.number
      })
    ));

    core.debug(`closing milestone ${currentMilestoneVersion}`);

    await client.issues.updateMilestone({
      owner,
      repo,
      milestone_number: latestSemverTaggedMilestone.number,
      state: "closed"
    });
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
