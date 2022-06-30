Setup
---
pulumi config set digitalocean:token XXXXXXXXXXXXXX --secret
pulumi config set --secret dbPassword YOUR_PASSWORD_HERE

The above config commands should create a default dev stack for you.


Run `yarn up` to have pulumi create a stack for you.

Explanation
---
This serves as an example for recreating [these instructions](https://www.edgedb.com/docs/guides/deployment/digitalocean) using Pulumi. Is this a good idea? I think so? Please tell me if I'm wrong in an issue.

This is also a reproduction of an issue I don't understand.

Running this stack multiple times results in an issue if the `configure-edgedb-password` command is changed. If something about it is altered, the commands will fail.

To recreate this, add something simple like an `ls` at the top of the command.

```
create: pulumi.interpolate`
		ls;
    printf "EDGEDB_SERVER_BACKEND_DSN=${DSN} \
    \nEDGEDB_SERVER_SECURITY=insecure_dev_mode\n" | cat > /etc/edgedb/env;
    systemctl restart edgedb.service;
    printf edgedbpassword | edgedb -H ${IP} --password-from-stdin --tls-security insecure query \
    "alter role edgedb set password := '${dbPassword}'";
    printf "EDGEDB_SERVER_BACKEND_DSN=${DSN} \
    \nEDGEDB_SERVER_SECURITY=strict\n" | cat > /etc/edgedb/env;
    systemctl restart edgedb.service;
    `,
```

Running the command will result in errors like this:

```
  command:remote:Command (configure-edgedb-password):
    error: /bin/sh: line 4: /etc/edgedb/env: No such file or directory
    error: /bin/sh: line 5: systemctl: command not found
    error: edgedb error: ClientError: AuthenticationError: authentication failed
    error: /bin/sh: line 9: /etc/edgedb/env: No such file or directory
    error: /bin/sh: line 10: systemctl: command not found
    error: exit status 127
```

The only way to get around this is to force a deletion and re-creation of the command by changing the name (add a number to the end or something)... I have no idea why.
