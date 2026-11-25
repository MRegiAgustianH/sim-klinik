import { Global, Module } from '@nestjs/common';
import { IdentityClient } from './identity-client.service';

@Global()
@Module({
  providers: [IdentityClient],
  exports: [IdentityClient],
})
export class IdentityModule {}
