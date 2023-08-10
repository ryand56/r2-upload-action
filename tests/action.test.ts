import { RunOptions, RunTarget } from "github-action-ts-run-api";
import * as dotenv from "dotenv";

dotenv.config();

describe("r2-upload-action", () => {
    const target = process.env.CI
        ? RunTarget.mainJs("action.yml")
        : RunTarget.jsFile("dist/index.js", "action.yml");

    it("Upload test directory to root of R2", async () => {
        const options = RunOptions.create({
            inputs: {
                "r2-account-id": process.env.TEST_R2_ACCOUNT_ID,
                "r2-access-key-id": process.env.TEST_R2_AKID,
                "r2-secret-access-key": process.env.TEST_R2_SECRET_AK,
                "r2-bucket": process.env.TEST_R2_BUCKET,
                "source-dir": "tests/dir/",
                "destination-dir": "./"
            }
        });
        const res = await target.run(options);

        expect(res.isSuccess).toEqual(true);
    });
});