import type {ReactNode} from 'react';
import type {PermissionKey} from '../../../../../packages/shared-types/src/permissions';
import {usePermissions} from '../../lib/permissions';
export function PermissionAction({permission,children}:{permission:PermissionKey;children:ReactNode}){
 const access=usePermissions();return access.hasPermission(permission)?<>{children}</>:null;
}
