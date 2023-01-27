// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function generateCommentBody(fileContents) {
    return `
        E2E Performance Test results:

        | Test | Duration |
        | --- | --- |
        ${fileContents?.passes?.forEach((pass) => `| ${pass.fullTitle} | ${pass.duration}`)}

        ${fileContents.failures?.length > 0 ? `
            Some tests failed:
            | Test | Duration |
            | --- | --- |
            ${fileContents?.failures?.forEach((pass) => `| ${pass.fullTitle} | ${pass.duration}`)}
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
