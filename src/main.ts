import * as core from "@actions/core";
import {ConfigManager} from "./ConfigManager";
import {NodeSSH, Config} from "node-ssh";

async function run(): Promise<void> {
	const ssh = new NodeSSH();

	try {
		const configManager = new ConfigManager();

		const sshConfig: Config = {
			host: configManager.config.host,
			port: configManager.config.port,
			username: configManager.config.user,
		};

		if (configManager.config.key) {
			sshConfig.privateKey = configManager.config.key;
		} else {
			sshConfig.password = sshConfig.password;
		}

		// initlaize ssh
		await ssh.connect(sshConfig);

		core.info("Connection estabilished...");

		// ignore action inputs when needed
		const envs = configManager.config.exportActionOptions
			? configManager.config.envs
			: configManager.config.envs.filter(({key}) =>
					ConfigManager.exportIgnoredEnvs.filter(ignoredKey => key.toLowerCase().includes(ignoredKey.toLowerCase()))
			  );

		// export provided envs
		configManager.config.command.unshift(`export ${envs.map(({key, value}) => `${key}="${value}"`).join(" ")}`);

		core.info(`Executing commands...`);

		const errBuffer: string[] = [];
		const outBuffer: string[] = [];

		await ssh.execCommand(configManager.config.command.join(";"), {
			onStdout: chunk => {
				const msg = chunk.toString("utf8").trim();
				if (msg.length === 0 || msg.startsWith("\n")) {
					console.log(`${msg.length === 0} ${msg.startsWith("\n")}, msg: ${msg}`);
					return;
				}

				outBuffer.push(msg);

				if (msg.endsWith("\n")) {
					console.log("out:", outBuffer.join(""));
					outBuffer.length = 0;
				}
			},
			onStderr: chunk => {
				const msg = chunk.toString("utf8").trim();
				if (msg.length === 0 || msg.startsWith("\n")) {
					console.log(`${msg.length === 0} ${msg.startsWith("\n")}, msg: ${msg}`);
					return;
				}

				errBuffer.push(msg);

				if (msg.endsWith("\n")) {
					console.log("err:", errBuffer.join(""));
					errBuffer.length = 0;
				}
			},
		});

		core.info("Done executing all commands!");
	} catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	} finally {
		ssh.dispose();
	}
}

run();
