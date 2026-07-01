export type AppVariables = {
  userId: string;
  user: { id: string; name: string; email: string };
};

export type AppEnv = { Variables: AppVariables };
