import type { ReactNode } from "react";
import Icon from "./Icon";

type EntityWorkspaceProps = {
  children: ReactNode;
  form: ReactNode;
  title: string;
};

export default function EntityWorkspace({ children, form, title }: EntityWorkspaceProps) {
  return (
    <div className="entity-workspace">
      <div className="entity-workspace__list">{children}</div>
      <aside className="entity-workspace__aside">
        <div className="entity-workspace__form-title">
          <span><Icon name="plus" size={18} /></span>
          <h2>{title}</h2>
        </div>
        {form}
      </aside>
    </div>
  );
}
