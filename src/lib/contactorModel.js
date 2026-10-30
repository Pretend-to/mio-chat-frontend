/** Commit server-owned models only after the server accepts the change. */
export async function setContactorModel(
  contactor,
  provider,
  model,
  { api, client },
) {
  if (contactor.platform === "agent") {
    const result = await api.request(
      `/api/agents/${encodeURIComponent(contactor.agentId || contactor.id)}`,
      {
        method: "PATCH",
        body: { provider, model },
      },
    );
    if (!contactor.options) contactor.options = {};
    contactor.options.provider = result.data.provider;
    contactor.options.model = result.data.model;
  } else {
    contactor.options.provider = provider;
    contactor.options.base.model = model;
    contactor.loadAvatar();
  }
  await client.saveNow();
}
