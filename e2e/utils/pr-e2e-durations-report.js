// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function generateCommentBody(fileContents) {
    const data = JSON.parse(fileContents);
    return `
E2E Performance Test results:

| Test | Duration |
| --- | --- |
${data?.passes?.forEach((pass) => `| ${pass.fullTitle} | ${pass.duration}`)}

${data?.failures?.length > 0 ? `
    Some tests failed:
    | Test | Duration |
    | --- | --- |
    ${data.failures.forEach((pass) => `| ${pass.fullTitle} | ${pass.duration}`)}
` : ''}

<details>
<summary>Raw results</summary>

\`\`\`js
${fileContents}
\`\`\`
</details>
`;
}

module.exports = {
    generateCommentBody,
};
