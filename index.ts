import * as pulumi from '@pulumi/pulumi';
import * as digitalocean from '@pulumi/digitalocean';
import * as command from '@pulumi/command';
import * as tls from '@pulumi/tls';
const config = new pulumi.Config();

// https://www.edgedb.com/docs/guides/deployment/digitalocean
// attempting to recreate these instructions with pulumi

// DigitalOcean credentials are required
// https://www.pulumi.com/registry/packages/digitalocean/installation-configuration/

// https://www.pulumi.com/docs/intro/concepts/config/
const dbPassword = config.requireSecret('dbPassword');

// getting stack to use the name of the stack
const stack = pulumi.getStack();

// https://www.pulumi.com/registry/packages/tls/
const sshKey = new tls.PrivateKey('sshKey', {
	algorithm: 'RSA',
	rsaBits: 4096,
});

// https://www.pulumi.com/registry/packages/digitalocean/api-docs/databasecluster/
const postgres_example = new digitalocean.DatabaseCluster(
	`edgedb-postgres-${stack}`,
	{
		engine: 'pg',
		nodeCount: 1,
		region: 'nyc1',
		size: 'db-s-1vcpu-1gb',
		version: '13',
	}
);

// Grab DSN for later commands
const DSN = postgres_example.uri;

// https://www.pulumi.com/registry/packages/digitalocean/api-docs/sshkey/
const _default = new digitalocean.SshKey('default', {
	publicKey: sshKey.publicKeyOpenssh,
});

// https://www.pulumi.com/registry/packages/digitalocean/api-docs/droplet/#droplet
const edgedbDroplet = new digitalocean.Droplet(`edgedb-droplet-${stack}`, {
	image: 'edgedb',
	region: 'sfo3',
	size: 's-1vcpu-1gb',
	ipv6: false, // default
	sshKeys: [_default.fingerprint],
});

// Grab IP address for later commands
const IP = edgedbDroplet.ipv4Address;

// https://www.pulumi.com/blog/executing-remote-commands/
// As instructions say, `edgedbpassword` is the default password, so we use that below
// to change the password to the one we want (set via the required secret config above)
new command.remote.Command('configure-edgedb-password', {
	connection: {
		host: IP,
		user: 'root',
		privateKey: sshKey.privateKeyPem,
	},
	create: pulumi.interpolate`
    printf "EDGEDB_SERVER_BACKEND_DSN=${DSN} \
    \nEDGEDB_SERVER_SECURITY=insecure_dev_mode\n" | cat > /etc/edgedb/env;
    systemctl restart edgedb.service;
    printf edgedbpassword | edgedb -H ${IP} --password-from-stdin --tls-security insecure query \
    "alter role edgedb set password := '${dbPassword}'";
    printf "EDGEDB_SERVER_BACKEND_DSN=${DSN} \
    \nEDGEDB_SERVER_SECURITY=strict\n" | cat > /etc/edgedb/env;
    systemctl restart edgedb.service;
    `,
});

export { IP, DSN };

// https://www.edgedb.com/docs/cli/edgedb_connopts
console.log(`To connect from local development machine:
// use dbPassword from pulumi config
printf $dbPassword | edgedb instance link \
    --password-from-stdin \
    --trust-tls-cert \
    --host $IP \
    --non-interactive \
    digitalocean
`);
