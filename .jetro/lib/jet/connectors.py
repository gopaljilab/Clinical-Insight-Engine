# jet.connectors — load agent-built data connectors
# Usage: from jet.connectors import use
#   client = use('google_sheets', spreadsheetId='1abc...')
#   data = client.fetch()
import json, os, importlib.util

WORKSPACE = os.environ.get("JET_WORKSPACE", os.getcwd())
CONNECTORS_DIR = os.path.join(WORKSPACE, ".jetro", "connectors")


def use(slug, **params):
    """Load a connector by slug and return its Client instance.

    Credentials are injected via JET_CRED_{KEY} environment variables
    by the extension before script execution.

    Args:
        slug: Connector slug (directory name under .jetro/connectors/)
        **params: Override default connector params

    Returns:
        Client instance from the connector's client.py module
    """
    conn_dir = os.path.join(CONNECTORS_DIR, slug)
    config_path = os.path.join(conn_dir, "connector.json")
    client_path = os.path.join(conn_dir, "client.py")

    with open(config_path) as f:
        config = json.load(f)

    # Resolve params: spec defaults < overrides
    resolved = {}
    for key, spec in config.get("params", {}).items():
        resolved[key] = params.get(key, spec.get("default"))
    resolved.update({k: v for k, v in params.items() if k not in resolved})

    # Get credential from env (injected by extension)
    cred_key = config.get("auth", {}).get("credentialKey")
    credential = None
    if cred_key:
        env_key = "JET_CRED_" + cred_key.upper().replace("-", "_")
        credential = os.environ.get(env_key)

    # Dynamic import client.py
    spec_obj = importlib.util.spec_from_file_location(
        f"jet_connector_{slug}", client_path)
    mod = importlib.util.module_from_spec(spec_obj)
    spec_obj.loader.exec_module(mod)

    return mod.Client(config=config, params=resolved, credential=credential)
