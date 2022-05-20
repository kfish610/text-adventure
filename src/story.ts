export type Option = {
    text: string;
    icon: string;
    next: string;
    return?: string;
};

export type Scene = {
    text: string;
    options?: Option[];
    loop?: string;
};

export type Story = Record<string, Scene>;