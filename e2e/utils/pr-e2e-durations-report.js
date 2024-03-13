// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function generateCommentBodyPerformanceTest(fileContents) {
    const data = JSON.parse(fileContents);

    return `
E2E Performance Test results:

| Test | Duration |
| --- | --- |
${data?.passes?.reduce((acc, pass) => {
        return `${acc}| ${pass.fullTitle || 'title'} | ${pass.duration}ms |\n`;
    }, '')
}

${data?.failures?.length > 0 ? `
    Some tests failed:
    | Test | Duration |
    | --- | --- |
    ${data.failures.forEach((failure) => `| ${failure.fullTitle} | ${failure.duration}`)}
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
    generateCommentBodyPerformanceTest,
};
