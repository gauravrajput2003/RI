import {Modal} from '../../components/ui/Modal';
import {PasswordRecoveryPanel} from './PasswordRecoveryPanel';
export function AccountPreviewGate({account,kind,onClose,onVerified}:{account:{id:string}|null;kind:'admin'|'client';onClose:()=>void;onVerified:(password:string|null)=>void}){
 return <Modal open={!!account} title="Confirm super-admin password" onClose={onClose}>{account&&<div className="account-preview-confirmation"><PasswordRecoveryPanel key={account.id} id={account.id} kind={kind} onVerified={onVerified}/></div>}</Modal>;
}
